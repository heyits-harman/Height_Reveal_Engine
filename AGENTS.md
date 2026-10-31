## Project Overview

Build a sleek, high-precision, dark-mode single-page frontend (React + Vite or HTML/Canvas) that connects to the Express backend (`/api/photogrammetry/analyze`). The app enables users to upload a photo, receive AI-detected anchor and posture bounding boxes, fine-tune alignment using a 4× zoom magnifier loupe, and reveal calculated true height without human setup bias.

---

## 1. Core Technical Architecture & File Structure

```
frontend/
├── index.html
├── package.json
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── components/
│   │   ├── Header.jsx                # Step indicator & Quality Standards modal trigger
│   │   ├── QualityStandardsModal.jsx  # Side-by-side eligible vs. limit cards
│   │   ├── ImageUploader.jsx         # Drag-and-drop file upload zone
│   │   ├── PhotogrammetryCanvas.jsx  # Interactive canvas with drag handles & zoom loupe
│   │   ├── ControlsPanel.jsx         # Anchor selector, shoe offset, depth compensation
│   │   └── HeightRevealModal.jsx     # Suspenseful final height output modal
│   ├── utils/
│   │   ├── photogrammetryMath.js     # Euclidean vector calculation & foreshortening math
│   │   └── apiService.js             # Axios client calling POST /api/photogrammetry/analyze
│   └── styles/
│       └── main.css                  # Minimalist high-contrast dark theme

```

---

## 2. API Integration Layer (`src/utils/apiService.js`)

Connects to the Express backend endpoint via `axios`:

```javascript
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api/photogrammetry';

/**
 * Sends an image file to backend for Gemini Vision detection
 * @param {File} file - User uploaded image file
 * @returns {Promise<Object>} Detected anchors, suitability score, and bounding boxes
 */
export async function analyzeImageFile(file) {
  const formData = new FormData();
  formData.append('image', file);

  const response = await axios.post(`${API_BASE_URL}/analyze`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  });

  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to analyze image.');
  }

  return response.data.data;
}

```

---

## 3. UI State Machine Workflow

The frontend must strictly transition through four sequential steps:

1. **Step 1: Upload & AI Pre-Screening (`SCAN_IMAGE`)**
* User drops an image or selects a sample.
* Triggers `analyzeImageFile()`.
* Displays photogrammetric quality score (e.g., `94% High Accuracy`) and advisory notes.


2. **Step 2: Interactive Point Alignment (`SET_ANCHORS`)**
* Canvas loads image with normalized points converted to pixel coordinates.
* Displays **Yellow Line (Anchor)** and **Cyan Line (Subject)** with draggable end handles.
* **Critical Rule:** Live height values **MUST BE HIDDEN** in this step to prevent human alignment bias.


3. **Step 3: Spec & Depth Verification (`VERIFY_SPECS`)**
* User verifies real-world anchor dimensions (e.g., iPhone 15 Pro Max: `6.30 in`).
* Adjusts footwear midsole lift offset slider (`0.0 to 3.0 in`).
* Adjusts depth compensation slider (`0.80x` foreground to `1.20x` background).


4. **Step 4: True Height Reveal (`REVEAL_RESULT`)**
* Plays suspenseful reveal state.
* Renders formatted true height (Feet/Inches & Centimeters), deducted shoe lift, and scale factor.



---

## 4. Photogrammetry Math Engine (`src/utils/photogrammetryMath.js`)

Implement vector calculations in native image resolution space to remain independent of canvas zoom:

```javascript
/**
 * Calculates Euclidean distance between two 2D points
 */
export function getVectorLength(p1, p2) {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

/**
 * Main Photogrammetry Height Calculation Engine
 * @param {Object} params
 * @param {Object} params.anchorP1 - {x, y} Anchor top in native image space
 * @param {Object} params.anchorP2 - {x, y} Anchor bottom in native image space
 * @param {Object} params.personP1 - {x, y} Crown scalp in native image space
 * @param {Object} params.personP2 - {x, y} Heel in native image space
 * @param {number} params.anchorRealInches - Verified real height of reference object
 * @param {number} params.soleOffsetInches - Shoe midsole deduction (e.g., 1.2 in)
 * @param {number} params.depthFactor - Foreshortening multiplier (e.g., 1.0)
 * @returns {Object} Formatted height breakdown
 */
export function calculateTrueHeight({
  anchorP1,
  anchorP2,
  personP1,
  personP2,
  anchorRealInches,
  soleOffsetInches = 1.2,
  depthFactor = 1.0,
}) {
  const anchorPixelLen = getVectorLength(anchorP1, anchorP2);
  const personPixelLen = getVectorLength(personP1, personP2);

  if (anchorPixelLen === 0) throw new Error('Anchor length cannot be zero.');

  // Pixels to inches ratio
  const inchesPerPixel = anchorRealInches / anchorPixelLen;

  // Unadjusted raw standing height
  const rawHeightInches = personPixelLen * inchesPerPixel * depthFactor;

  // Final height after footwear midsole deduction
  const trueHeightInches = Math.max(0, rawHeightInches - soleOffsetInches);

  const feet = Math.floor(trueHeightInches / 12);
  const inches = (trueHeightInches % 12).toFixed(1);
  const totalCm = (trueHeightInches * 2.54).toFixed(1);

  return {
    inchesPerPixel: inchesPerPixel.toFixed(5),
    rawHeightInches: rawHeightInches.toFixed(1),
    deductedSoleInches: soleOffsetInches.toFixed(1),
    trueHeightInches: trueHeightInches.toFixed(1),
    formattedFeetInches: `${feet}' ${inches}"`,
    formattedCm: `${totalCm} cm`,
  };
}

```

---

## 5. Precision Zoom Loupe Canvas (`PhotogrammetryCanvas.jsx`)

When dragging or hovering near handles, render a $4\times$ zoom lens loupe:

```javascript
// Render Loupe Magnifier on Canvas Overlay
function drawMagnifierLoupe(ctx, mouseX, mouseY, sourceCanvas) {
  const loupeRadius = 60;
  const zoomFactor = 4;

  ctx.save();
  ctx.beginPath();
  ctx.arc(mouseX, mouseY - 80, loupeRadius, 0, Math.PI * 2);
  ctx.clip();

  // Draw magnified image slice
  ctx.drawImage(
    sourceCanvas,
    mouseX - loupeRadius / zoomFactor,
    mouseY - loupeRadius / zoomFactor,
    (loupeRadius * 2) / zoomFactor,
    (loupeRadius * 2) / zoomFactor,
    mouseX - loupeRadius,
    mouseY - 80 - loupeRadius,
    loupeRadius * 2,
    loupeRadius * 2
  );

  // Loupe Border & Crosshair
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#00f2fe';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(mouseX - 10, mouseY - 80);
  ctx.lineTo(mouseX + 10, mouseY - 80);
  ctx.moveTo(mouseX, mouseY - 80 - 10);
  ctx.lineTo(mouseX, mouseY - 80 + 10);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

```

---

## 6. Pre-Flight Quality Standards Guidance (`QualityStandardsModal.jsx`)

Provide clear visual cards for user pre-screening:

* **Supported (High Accuracy):**
* In-hand tech anchors (iPhone 15/16 Pro Max, soda cans).
* Co-planar standing positions (subject & anchor at equal depth).
* Upright stance with clear crown scalp and shoe heels visible.


* **Limits Reached (Low Accuracy Warnings):**
* Extreme camera pitch tilt ($>35^\circ$ low-angle or high-angle tilt).
* Large depth separation gap ($>3\text{ ft}$ foreground/background separation without floor line).
* Obscured top-of-head scalp or shoes buried in deep carpet/grass.



---

## 7. Instructions for Agent Implementation

1. Initialize project using Vite + React (`npm create vite@latest frontend -- --template react`).
2. Install dependencies: `npm install axios lucide-react clsx`.
3. Configure `API_BASE_URL` in `.env` (`VITE_API_BASE_URL=http://localhost:5000/api/photogrammetry`).
4. Implement components following the 4-step state machine (`SCAN_IMAGE` $\rightarrow$ `SET_ANCHORS` $\rightarrow$ `VERIFY_SPECS` $\rightarrow$ `REVEAL_RESULT`).
5. Ensure mouse/touch coordinates accurately map from client display pixels to native image resolution space (`image.naturalWidth / canvas.clientWidth`).
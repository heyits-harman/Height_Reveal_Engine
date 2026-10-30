import { analyzeImageForPhotogrammetry } from '../services/llmService.js';

/**
 * Controller to handle image upload and photogrammetry analysis request.
 * @param {Object} req - Express Request object (contains file from Multer)
 * @param {Object} res - Express Response object
 */
export async function analyzeImage(req, res) {
  try {
    // 1. Validate that an image file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file uploaded. Please upload a valid image (JPEG, PNG, WEBP).'
      });
    }

    const { buffer, mimetype, originalname } = req.file;

    console.log(`[PhotogrammetryController] Processing file: ${originalname} (${mimetype}, ${buffer.length} bytes)`);

    // 2. Call the LLM Vision service via Axios
    const analysisResult = await analyzeImageForPhotogrammetry(buffer, mimetype);

    // 3. Optional Backend Sanity Validation on LLM bounding boxes
    const { detectedAnchor, subjectKeypoints } = analysisResult;

    if (detectedAnchor && detectedAnchor.boundingBox) {
      const { ymin, ymax } = detectedAnchor.boundingBox;
      const pixelSpanNormalized = Math.abs(ymax - ymin);

      // Flag if anchor bounding box is unrealistically tiny (< 0.5% of image height)
      if (pixelSpanNormalized < 5) {
        analysisResult.qualityNotes += ' (Warning: Anchor detected is very small relative to image frame; manual adjustment recommended.)';
      }
    }

    // 4. Return structured analysis payload to the frontend
    return res.status(200).json({
      success: true,
      data: {
        fileName: originalname,
        photogrammetricSuitabilityScore: analysisResult.photogrammetricSuitabilityScore,
        qualityNotes: analysisResult.qualityNotes,
        detectedAnchor: analysisResult.detectedAnchor,
        subjectKeypoints: analysisResult.subjectKeypoints
      }
    });

  } catch (error) {
    console.error('[PhotogrammetryController Error]:', error.message);

    return res.status(500).json({
      success: false,
      error: 'Failed to process image for photogrammetry analysis.',
      details: error.message
    });
  }
}
import axios from 'axios';

/**
 * Service to analyze an image for photogrammetry anchor detection & posture keypoints via Gemini REST API.
 * @param {Buffer} imageBuffer - Raw image buffer uploaded by the user.
 * @param {string} mimeType - Image MIME type (e.g., 'image/jpeg', 'image/png').
 * @returns {Promise<Object>} Structured photogrammetry metadata & bounding box coordinates.
 */
export async function analyzeImageForPhotogrammetry(imageBuffer, mimeType = 'image/jpeg') {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is missing.');
  }

  // Gemini REST API Endpoint for gemini-2.5-flash
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

  const base64Image = imageBuffer.toString('base64');

  const prompt = `
    You are an expert photogrammetry computer vision assistant.
    Analyze the provided photo to identify reliable reference objects for height calculation.

    Tasks:
    1. Detect the primary reference/anchor object in the photo (e.g., in-hand smartphone such as iPhone 15 Pro/Pro Max, soda can, commercial door frame, shoe outsole).
    2. Identify the specific model or item type and estimate its standard real-world height in inches.
    3. Return normalized bounding box coordinates [ymin, xmin, ymax, xmax] for the anchor object on a 0 to 1000 scale.
    4. Locate the person in the photo and estimate their crown (top of head scalp) and heel bounding positions [ymin, xmin, ymax, xmax].
    5. Evaluate the image suitability for photogrammetry (assess camera pitch tilt, foreshortening, and visibility).
  `;

  // Define JSON Schema for Structured Output Enforcement
  const responseSchema = {
    type: 'OBJECT',
    properties: {
      photogrammetricSuitabilityScore: {
        type: 'NUMBER',
        description: 'Confidence score from 0 to 100 on photogrammetric quality.',
      },
      qualityNotes: {
        type: 'STRING',
        description: 'Brief explanation of suitability, camera tilt, or depth gaps.',
      },
      detectedAnchor: {
        type: 'OBJECT',
        properties: {
          objectLabel: { type: 'STRING' },
          category: {
            type: 'STRING',
            enum: ['IN_HAND_DEVICE', 'FOOTWEAR_OUTSOLE', 'BACKGROUND_STRUCTURE', 'BEVERAGE_CONTAINER', 'UNKNOWN'],
          },
          estimatedRealHeightInches: { type: 'NUMBER' },
          boundingBox: {
            type: 'OBJECT',
            properties: {
              ymin: { type: 'NUMBER' },
              xmin: { type: 'NUMBER' },
              ymax: { type: 'NUMBER' },
              xmax: { type: 'NUMBER' },
            },
            required: ['ymin', 'xmin', 'ymax', 'xmax'],
          },
        },
        required: ['objectLabel', 'category', 'estimatedRealHeightInches', 'boundingBox'],
      },
      subjectKeypoints: {
        type: 'OBJECT',
        properties: {
          crownBoundingBox: {
            type: 'OBJECT',
            properties: {
              ymin: { type: 'NUMBER' },
              xmin: { type: 'NUMBER' },
              ymax: { type: 'NUMBER' },
              xmax: { type: 'NUMBER' },
            },
            required: ['ymin', 'xmin', 'ymax', 'xmax'],
          },
          heelBoundingBox: {
            type: 'OBJECT',
            properties: {
              ymin: { type: 'NUMBER' },
              xmin: { type: 'NUMBER' },
              ymax: { type: 'NUMBER' },
              xmax: { type: 'NUMBER' },
            },
            required: ['ymin', 'xmin', 'ymax', 'xmax'],
          },
        },
        required: ['crownBoundingBox', 'heelBoundingBox'],
      },
    },
    required: [
      'photogrammetricSuitabilityScore',
      'qualityNotes',
      'detectedAnchor',
      'subjectKeypoints',
    ],
  };

  const payload = {
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Image,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: 'application/json',
      response_schema: responseSchema,
      temperature: 0.2,
    },
  };

  try {
    const response = await axios.post(endpoint, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 15000, // 15-second timeout safeguard
    });

    // Extract raw text content returned from Gemini REST response
    const rawText = response.data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error('Gemini API returned an empty text payload.');
    }

    return JSON.parse(rawText);
  } catch (error) {
    const errMessage = error.response?.data?.error?.message || error.message;
    console.error('Axios Gemini Vision API Error:', errMessage);
    throw new Error(`Photogrammetry Analysis Failed: ${errMessage}`);
  }
}
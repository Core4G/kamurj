import fs from 'fs/promises';
import path from 'path';

type DocCheckPayload = {
  passportNumber: string;
  passportType: string;
  passportIssueDate?: string;
  passportValidTill?: string;
  firstName: string;
  lastName: string;
};

type FaceCheckPayload = {
  videoFile: any;
  passportImage: string;
  sessionId: string;
  deviceId: string;
  platform: string;
  appVersion: string;
};

const resolveLocalFilePath = (source: string) => {
  const value = String(source || '').trim();
  if (!value) {
    return null;
  }

  if (value.startsWith('/uploads/')) {
    return path.join(process.cwd(), 'public', value);
  }

  if (value.startsWith('public/')) {
    return path.join(process.cwd(), value);
  }

  if (value.startsWith('/')) {
    return value;
  }

  return path.join(process.cwd(), value);
};

const readAsBlob = async (filePath: string, mimeType: string) => {
  const bytes = await fs.readFile(filePath);
  return new Blob([bytes], { type: mimeType });
};

const appendUploadedVideo = async (form: FormData, video: any) => {
  const videoPath = video?.filepath || video?.path;

  if (!videoPath) {
    const error: any = new Error('Invalid video payload');
    error.status = 400;
    throw error;
  }

  const mimeType = String(video?.mimetype || 'video/mp4');
  const fileName = String(video?.originalFilename || video?.name || 'video.mp4');
  const videoBlob = await readAsBlob(videoPath, mimeType);
  form.append('video', videoBlob, fileName);
};

const appendPassportImage = async (form: FormData, passportImageSource: string) => {
  const filePath = resolveLocalFilePath(passportImageSource);

  if (!filePath) {
    const error: any = new Error('Passport image is not available');
    error.status = 400;
    throw error;
  }

  const imageBlob = await readAsBlob(filePath, 'image/png');
  form.append('passportImage', imageBlob, path.basename(filePath));
};

const assertProviderConfigured = (url: string | undefined, providerName: string) => {
  if (!url) {
    const error: any = new Error(`${providerName} provider is not configured`);
    error.status = 500;
    throw error;
  }
};

export const callDocProvider = async (payload: DocCheckPayload) => {
  const mockEnabled = process.env.MOCK_KYC_DOC_PROVIDER_ENABLED !== 'false';

  if (mockEnabled) {
    return {
      ssn: 3412910627,
      docs: [
        {
          number: 'AS0497150',
          docType: payload.passportType || 'PASSPORT',
          status: 'PRIMARY_VALID',
          name: 'Gor',
          surname: 'Gevorgyan',
          image: '/uploads/testPassport.png',
        },
      ],
    };
  }

  const url = process.env.KYC_DOC_API_URL;
  assertProviderConfigured(url, 'DOC KYC');

  const response = await fetch(url!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: process.env.KYC_DOC_API_TOKEN ? `Bearer ${process.env.KYC_DOC_API_TOKEN}` : '',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error: any = new Error('Doc provider request failed');
    error.status = 502;
    throw error;
  }

  return response.json();
};

export const callFaceProvider = async (payload: FaceCheckPayload) => {
  const url = process.env.KYC_FACE_API_URL || 'http://192.168.5.2:3000/kyc/liveness';
  const faceAuthToken = String(process.env.KYC_FACE_API_TOKEN || '').trim() || 'face-provider-default-token';
  assertProviderConfigured(url, 'FACE KYC');

  const form = new FormData();
  await appendUploadedVideo(form, payload.videoFile);
  await appendPassportImage(form, payload.passportImage);
  form.append('sessionId', payload.sessionId);
  form.append('deviceId', payload.deviceId);
  form.append('platform', payload.platform);
  form.append('appVersion', payload.appVersion);

  const response = await fetch(url!, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${faceAuthToken}`,
    },
    body: form,
  });

  const app = (globalThis as any).strapi;

  let responsePayload: any = null;
  try {
    responsePayload = await response.clone().json();
  } catch (_error) {
    try {
      responsePayload = await response.text();
    } catch {
      responsePayload = null;
    }
  }

  app?.log?.info(
    `[kyc] face provider response status=${response.status} payload=${JSON.stringify(responsePayload)}`,
  );

  if (!response.ok) {
    const error: any = new Error('Face provider request failed');
    error.status = 502;
    throw error;
  }

  return responsePayload;
};

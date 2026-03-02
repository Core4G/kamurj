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
  passportImage?: string;
  passportImageRef?: string;
};

const assertProviderConfigured = (url: string | undefined, providerName: string) => {
  if (!url) {
    const error: any = new Error(`${providerName} provider is not configured`);
    error.status = 500;
    throw error;
  }
};

export const callDocProvider = async (payload: DocCheckPayload) => {
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
  const url = process.env.KYC_FACE_API_URL;
  assertProviderConfigured(url, 'FACE KYC');

  const form = new FormData();
  form.append('video', payload.videoFile as any);

  if (payload.passportImage) {
    form.append('passportImage', payload.passportImage);
  }

  if (payload.passportImageRef) {
    form.append('passportImageRef', payload.passportImageRef);
  }

  const response = await fetch(url!, {
    method: 'POST',
    headers: {
      Authorization: process.env.KYC_FACE_API_TOKEN ? `Bearer ${process.env.KYC_FACE_API_TOKEN}` : '',
    },
    body: form,
  });

  if (!response.ok) {
    const error: any = new Error('Face provider request failed');
    error.status = 502;
    throw error;
  }

  return response.json();
};

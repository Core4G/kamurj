export const normalizeName = (value: string | null | undefined) => {
  if (!value) {
    return '';
  }

  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};

export const isDocumentExpired = (validTill: string | Date | null | undefined) => {
  if (!validTill) {
    return false;
  }

  const expiryDate = new Date(validTill);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return expiryDate.getTime() < today.getTime();
};

export const findMatchingPassport = (
  profile: {
    passportNumber: string;
    firstName: string;
    lastName: string;
  },
  passports: Array<{
    number?: string;
    issueDate?: string;
    validTill?: string;
    name?: string;
    surname?: string;
    image?: string;
    validFlag?: boolean;
  }>,
) => {
  const profileFirst = normalizeName(profile.firstName);
  const profileLast = normalizeName(profile.lastName);

  return passports.find((passport) => {
    return (
      String(passport.number || '').trim() === String(profile.passportNumber || '').trim() &&
      normalizeName(passport.name) === profileFirst &&
      normalizeName(passport.surname) === profileLast
    );
  });
};

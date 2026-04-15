export type ParsedUserAgent = {
  browser: string;
  os: string;
  deviceType: string;
};

export function parseUserAgent(rawUserAgent: string | null | undefined): ParsedUserAgent {
  const ua = (rawUserAgent ?? '').toLowerCase();

  const browser = ua.includes('edg/')
    ? 'Edge'
    : ua.includes('chrome/')
      ? 'Chrome'
      : ua.includes('safari/') && !ua.includes('chrome/')
        ? 'Safari'
        : ua.includes('firefox/')
          ? 'Firefox'
          : ua.includes('opera') || ua.includes('opr/')
            ? 'Opera'
            : 'Other';

  const os = ua.includes('windows')
    ? 'Windows'
    : ua.includes('mac os')
      ? 'macOS'
      : ua.includes('android')
        ? 'Android'
        : ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')
          ? 'iOS'
          : ua.includes('linux')
            ? 'Linux'
            : 'Other';

  const deviceType =
    ua.includes('mobile') || ua.includes('iphone') || ua.includes('android')
      ? 'mobile'
      : ua.includes('ipad') || ua.includes('tablet')
        ? 'tablet'
        : 'desktop';

  return {
    browser,
    os,
    deviceType
  };
}

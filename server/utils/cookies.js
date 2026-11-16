function readCookie(request, name) {
  const cookieHeader = request?.headers?.cookie;
  if (typeof cookieHeader !== "string") {
    return null;
  }

  const prefix = `${name}=`;
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  if (!cookie) {
    return null;
  }

  try {
    return decodeURIComponent(cookie.slice(prefix.length));
  } catch {
    return null;
  }
}

module.exports = { readCookie };

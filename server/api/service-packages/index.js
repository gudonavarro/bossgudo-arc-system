// The catch-all route does not match the bare collection path, so
// /api/service-packages is served by the same handler here.
export { default } from "./[...path].js";

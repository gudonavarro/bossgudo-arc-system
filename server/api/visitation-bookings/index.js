// The catch-all route does not match the bare collection path, so
// /api/visitation-bookings is served by the same handler here.
export { default } from "./[...path].js";

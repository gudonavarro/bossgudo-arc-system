// The catch-all route does not match the bare collection path, so
// /api/admin/service-bookings is served by the same handler here.
export { default } from "./[...path].js";

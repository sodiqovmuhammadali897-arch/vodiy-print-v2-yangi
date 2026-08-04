export type GeoResult = { latitude: number; longitude: number };

export class GeolocationDeniedError extends Error {}

// Cloud Functions re-verify the office distance server-side, so this
// client-side read only exists to grab coordinates and give the user fast
// feedback — it is never the security boundary itself.
export const getCurrentPosition = (): Promise<GeoResult> =>
  new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new GeolocationDeniedError("Bu qurilmada GPS mavjud emas"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => {
        reject(
          new GeolocationDeniedError(
            err.code === err.PERMISSION_DENIED
              ? "Joylashuvga ruxsat berilmadi. Davomat belgilash uchun GPS ruxsati kerak."
              : "Joylashuvni aniqlab bo'lmadi. Qaytadan urinib ko'ring.",
          ),
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });

const EARTH_RADIUS_M = 6371000;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

export const distanceMeters = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number => {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
};

import { getUserReadings } from "../api/database";

export default async function getReadings() {
  return getUserReadings();
}

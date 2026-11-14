/** Vercel serverless function: GET /api/space-weather (NASA DONKI). Set NASA_API_KEY in the Vercel project. */
import {handleSpaceWeather} from '../server/space-weather.js';

export function GET(): Promise<Response> {
  return handleSpaceWeather();
}

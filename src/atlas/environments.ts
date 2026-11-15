import type {EnvironmentId} from '../health/model';

/**
 * Look of the 3D stage for each mission environment: background, ground, platform,
 * lights and starfield. Adapted from the Allinsonqo UI/3D atlas.
 */
export interface StagePreset {
  background: number;
  ground: number;
  platform: number;
  ring: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  keyColor: number;
  keyIntensity: number;
  rimColor: number;
  rimIntensity: number;
  stars: boolean;
  exposure: number;
}

export const STAGES: Record<EnvironmentId, StagePreset> = {
  // Low Earth orbit aboard the station.
  iss: {
    background: 0x0a1021, ground: 0x111a2e, platform: 0x182338, ring: 0x5d7c9b,
    hemiSky: 0x8fb8ff, hemiGround: 0x1a2433, hemiIntensity: 1.05,
    keyColor: 0xfff4e6, keyIntensity: 2.6, rimColor: 0x7fb6ff, rimIntensity: 2.0,
    stars: true, exposure: 1.14,
  },
  // Long-duration transit beyond low Earth orbit.
  orion: {
    background: 0x03050b, ground: 0x080b12, platform: 0x111823, ring: 0x5c6f8c,
    hemiSky: 0x9fb6ff, hemiGround: 0x0a0d16, hemiIntensity: 0.7,
    keyColor: 0xf2f6ff, keyIntensity: 2.4, rimColor: 0x6f8fff, rimIntensity: 1.8,
    stars: true, exposure: 1.2,
  },
  // Partial gravity and hard, unfiltered sunlight on the Moon.
  moon: {
    background: 0x0c0f14, ground: 0x14171c, platform: 0x2a2d33, ring: 0x8b939e,
    hemiSky: 0xdfe6f0, hemiGround: 0x1a1d22, hemiIntensity: 0.9,
    keyColor: 0xffffff, keyIntensity: 3.0, rimColor: 0x9fb4cc, rimIntensity: 1.2,
    stars: true, exposure: 1.05,
  },
  // Thin atmosphere, dust and reduced gravity on Mars.
  mars: {
    background: 0x1b0d0a, ground: 0x1f100c, platform: 0x3a1f18, ring: 0xb06a4f,
    hemiSky: 0xffb38a, hemiGround: 0x2a1512, hemiIntensity: 1.0,
    keyColor: 0xffd7b0, keyIntensity: 2.8, rimColor: 0xff7d4f, rimIntensity: 1.6,
    stars: true, exposure: 1.15,
  },
};

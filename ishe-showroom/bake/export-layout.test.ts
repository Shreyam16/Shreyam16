// Run with: npx vitest run --config bake/vitest.config.ts
// Writes bake/layout.json: the floor plan Blender uses to rebuild the room for light baking.
import { it } from 'vitest';
import fs from 'node:fs';
import {
  DISPLAYS, WALLS, COLUMNS, CASHIER, COMBO_TABLE, CEILING, HALF_W, DEPTH, FRONT_DOOR, displayFootprint,
} from '@/scene/layout';
import { FEATURES } from '@/scene/features';
import { BAKE_SURFACES } from '@/scene/bakeSurfaces';

it('exports layout', () => {
  const data = {
    CEILING, HALF_W, DEPTH, FRONT_DOOR,
    surfaces: BAKE_SURFACES, walls: WALLS, columns: COLUMNS, cashier: CASHIER, comboTable: COMBO_TABLE, features: FEATURES,
    displays: DISPLAYS.map((d) => ({ ...d, box: displayFootprint(d) })),
  };
  fs.writeFileSync('bake/layout.json', JSON.stringify(data, null, 2));
});

// Gilded Heist — level definitions.
// One job: describe the three rooms (walls, guards, cameras, loot, exit, shadows).
// Coordinates are in canvas pixels. The playfield is x 24..1256, y 96..668.

export const PLAY = { x: 24, y: 96, w: 1232, h: 572 };

export const LEVELS = [
  {
    name: 'The Gilded Gallery',
    intro: 'A quiet museum after dark. Lift every exhibit, then slip out the top door.',
    playerStart: { x: 80, y: 140 },
    exit: { x: 1200, y: 130 },
    walls: [
      { x: 430, y: 130, w: 16, h: 250 },
      { x: 430, y: 470, w: 16, h: 160 },
      { x: 700, y: 300, w: 200, h: 16 },
      { x: 640, y: 180, w: 150, h: 90 },
      { x: 950, y: 480, w: 140, h: 80 },
    ],
    shadows: [
      { x: 60, y: 300, w: 180, h: 120 },
      { x: 900, y: 560, w: 200, h: 80 },
    ],
    guards: [
      {
        name: 'Night Watchman',
        waypoints: [
          { x: 120, y: 160 },
          { x: 340, y: 160 },
          { x: 340, y: 600 },
          { x: 120, y: 600 },
        ],
      },
      {
        name: 'Gallery Guard',
        waypoints: [
          { x: 600, y: 160 },
          { x: 1120, y: 160 },
          { x: 1120, y: 600 },
          { x: 600, y: 600 },
        ],
      },
    ],
    cameras: [
      { x: 500, y: 110, baseAngle: Math.PI / 2, sweep: 0.6, speed: 0.7 },
      { x: 1240, y: 300, baseAngle: Math.PI, sweep: 0.5, speed: 0.9 },
    ],
    loot: [
      { x: 500, y: 150, kind: 'painting', label: 'Sunset Canvas' },
      { x: 715, y: 290, kind: 'gem', label: 'Star Sapphire' },
      { x: 150, y: 600, kind: 'vase', label: 'Porcelain Vase' },
      { x: 1150, y: 620, kind: 'statue', label: 'Bronze Falcon' },
    ],
  },
  {
    name: 'The Vault Wing',
    intro: 'The bank vault wing. Three guards, three cameras, five prizes. Stay in the dark.',
    playerStart: { x: 80, y: 140 },
    exit: { x: 1200, y: 130 },
    walls: [
      { x: 640, y: 130, w: 16, h: 220 },
      { x: 640, y: 440, w: 16, h: 190 },
      { x: 900, y: 200, w: 220, h: 16 },
      { x: 300, y: 480, w: 220, h: 16 },
      { x: 900, y: 420, w: 160, h: 90 },
      { x: 250, y: 220, w: 120, h: 80 },
    ],
    shadows: [
      { x: 80, y: 400, w: 180, h: 110 },
      { x: 1000, y: 120, w: 180, h: 90 },
    ],
    guards: [
      {
        name: 'Vault Warden',
        waypoints: [
          { x: 120, y: 160 },
          { x: 520, y: 160 },
          { x: 520, y: 600 },
          { x: 120, y: 600 },
        ],
      },
      {
        name: 'Corridor Guard',
        waypoints: [
          { x: 760, y: 160 },
          { x: 1140, y: 160 },
          { x: 1140, y: 600 },
          { x: 760, y: 600 },
        ],
      },
      {
        name: 'Door Watcher',
        waypoints: [
          { x: 560, y: 400 },
          { x: 620, y: 400 },
          { x: 620, y: 580 },
          { x: 560, y: 580 },
        ],
      },
    ],
    cameras: [
      { x: 400, y: 110, baseAngle: Math.PI / 2, sweep: 0.5, speed: 0.8 },
      { x: 1250, y: 480, baseAngle: Math.PI, sweep: 0.5, speed: 0.7 },
      { x: 850, y: 650, baseAngle: -Math.PI / 2, sweep: 0.6, speed: 0.9 },
    ],
    loot: [
      { x: 300, y: 260, kind: 'gem', label: 'Vault Ruby' },
      { x: 560, y: 600, kind: 'painting', label: 'Old Master' },
      { x: 800, y: 150, kind: 'statue', label: 'Golden Owl' },
      { x: 1080, y: 300, kind: 'vase', label: 'Jade Vase' },
      { x: 1150, y: 620, kind: 'gem', label: 'Vault Diamond' },
    ],
  },
  {
    name: 'The Penthouse',
    intro: 'The final score. An open penthouse, three patrols, six prizes. Take it all.',
    playerStart: { x: 80, y: 140 },
    exit: { x: 1200, y: 130 },
    walls: [
      { x: 400, y: 250, w: 60, h: 60 },
      { x: 850, y: 250, w: 60, h: 60 },
      { x: 400, y: 480, w: 60, h: 60 },
      { x: 850, y: 480, w: 60, h: 60 },
      { x: 560, y: 360, w: 180, h: 16 },
    ],
    shadows: [
      { x: 500, y: 200, w: 200, h: 80 },
      { x: 60, y: 500, w: 160, h: 100 },
    ],
    guards: [
      {
        name: 'Penthouse Guard',
        waypoints: [
          { x: 150, y: 150 },
          { x: 150, y: 600 },
          { x: 350, y: 600 },
          { x: 350, y: 150 },
        ],
      },
      {
        name: 'Terrace Guard',
        waypoints: [
          { x: 950, y: 150 },
          { x: 950, y: 600 },
          { x: 1120, y: 600 },
          { x: 1120, y: 150 },
        ],
      },
      {
        name: 'Hall Guard',
        waypoints: [
          { x: 520, y: 150 },
          { x: 520, y: 600 },
          { x: 760, y: 600 },
          { x: 760, y: 150 },
        ],
      },
    ],
    cameras: [
      { x: 640, y: 110, baseAngle: Math.PI / 2, sweep: 0.7, speed: 0.8 },
      { x: 1250, y: 360, baseAngle: Math.PI, sweep: 0.6, speed: 1.0 },
    ],
    loot: [
      { x: 200, y: 350, kind: 'painting', label: 'Midnight Portrait' },
      { x: 1100, y: 350, kind: 'gem', label: 'Crown Jewel' },
      { x: 640, y: 300, kind: 'statue', label: 'Gold Panther' },
      { x: 640, y: 470, kind: 'vase', label: 'Crystal Vase' },
      { x: 300, y: 620, kind: 'gem', label: 'Penthouse Opal' },
      { x: 1000, y: 620, kind: 'painting', label: 'Aurora Canvas' },
    ],
  },
];

export const EASE_OUT   = [0.22, 1, 0.36, 1] as [number, number, number, number];
export const EASE_IN    = [0.4, 0, 1, 1]    as [number, number, number, number];
export const EASE_INOUT = [0.4, 0, 0.2, 1]  as [number, number, number, number];

export const SPRING_GENTLE = { type: 'spring', stiffness: 280, damping: 28 } as const;
export const SPRING_BOUNCY = { type: 'spring', stiffness: 400, damping: 20 } as const;
export const SPRING_STIFF  = { type: 'spring', stiffness: 500, damping: 35 } as const;

export const DUR_XS = 0.12;
export const DUR_SM = 0.18;
export const DUR_MD = 0.28;
export const DUR_LG = 0.45;
export const DUR_XL = 0.70;

export const STAGGER_FAST = 0.04;
export const STAGGER_MED  = 0.06;
export const STAGGER_SLOW = 0.10;

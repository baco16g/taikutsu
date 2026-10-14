interface TextureFiltersProps {
  idPrefix: string
}

interface MineralFilterProps {
  id: string
  grainSeed: number
  patchSeed: number
}

/** One mineral filter instance. Two of these (different seeds) are cross-faded and drifted at different rates to read as flowing, without ever re-running the filter itself. */
function MineralFilter({ id, grainSeed, patchSeed }: MineralFilterProps) {
  return (
    <filter id={id} x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.45"
        numOctaves={2}
        seed={grainSeed}
        result="grainRaw"
      />
      <feColorMatrix in="grainRaw" type="saturate" values="0" result="grainGray" />
      <feComponentTransfer in="grainGray" result="grainContrast">
        <feFuncR type="gamma" amplitude={1} exponent={1.8} offset={0} />
        <feFuncG type="gamma" amplitude={1} exponent={1.8} offset={0} />
        <feFuncB type="gamma" amplitude={1} exponent={1.8} offset={0} />
      </feComponentTransfer>
      <feComponentTransfer in="grainContrast" result="grainToned">
        <feFuncR type="linear" slope={0.34} intercept={0.03} />
        <feFuncG type="linear" slope={0.34} intercept={0.035} />
        <feFuncB type="linear" slope={0.36} intercept={0.045} />
        <feFuncA type="linear" slope={0} intercept={1} />
      </feComponentTransfer>
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.02"
        numOctaves={3}
        seed={patchSeed}
        result="patchRaw"
      />
      <feColorMatrix in="patchRaw" type="saturate" values="0" result="patchGray" />
      <feComponentTransfer in="patchGray" result="patchToned">
        <feFuncR type="linear" slope={0.36} intercept={0} />
        <feFuncG type="linear" slope={0.36} intercept={0} />
        <feFuncB type="linear" slope={0.38} intercept={0} />
        <feFuncA type="linear" slope={0} intercept={0.7} />
      </feComponentTransfer>
      <feBlend in="patchToned" in2="grainToned" mode="multiply" />
    </filter>
  )
}

/**
 * Pure SVG filter noise: no raster assets, scales for free, and — because
 * none of the filter primitive attributes are ever animated from JS — the
 * browser paints them once and composites the (cheap) transform/opacity
 * animations on top instead of re-running the filter every frame.
 *
 * Two filter instances (different seeds) are cross-faded and drifted at
 * independent speeds by TextureLayer, which reads as the grain itself
 * shifting rather than a single static image sliding around.
 */
export function TextureFilters({ idPrefix }: TextureFiltersProps) {
  return (
    <>
      <MineralFilter id={`${idPrefix}-mineral-a`} grainSeed={8} patchSeed={2} />
      <MineralFilter id={`${idPrefix}-mineral-b`} grainSeed={19} patchSeed={13} />
    </>
  )
}

interface TextureLayerProps {
  idPrefix: string
  size: number
  driftRefA?: React.Ref<SVGGElement>
  driftRefB?: React.Ref<SVGGElement>
}

/**
 * Two drifting/cross-fading copies of the filtered noise (different seeds)
 * plus a rim vignette for ambient occlusion (no gloss, per spec — this is
 * meant to read as matte, not metallic). Lives inside the creature's
 * clipPath group.
 *
 * Layer B blends with 'screen', not 'overlay'/'multiply': this texture's
 * tones are already dark and low-contrast, and both of those modes fold
 * toward *darker* when both inputs are dark — at higher cross-fade opacity
 * that was visibly crushing the grain toward flat black. 'screen' only ever
 * brightens, so the second layer adds visible fleck/variation instead of
 * eating it.
 */
export function TextureLayer({ idPrefix, size, driftRefA, driftRefB }: TextureLayerProps) {
  const pad = size * 0.3
  const rectProps = { x: -pad, y: -pad, width: size + pad * 2, height: size + pad * 2 }

  return (
    <>
      <g ref={driftRefA}>
        <rect {...rectProps} filter={`url(#${idPrefix}-mineral-a)`} />
      </g>
      <g ref={driftRefB} style={{ mixBlendMode: 'screen' }}>
        <rect {...rectProps} filter={`url(#${idPrefix}-mineral-b)`} />
      </g>
      <rect
        {...rectProps}
        fill={`url(#${idPrefix}-mineral-vignette)`}
        style={{ mixBlendMode: 'multiply' }}
      />
    </>
  )
}

export function TextureGradients({ idPrefix, size }: { idPrefix: string; size: number }) {
  return (
    <radialGradient
      id={`${idPrefix}-mineral-vignette`}
      cx={size * 0.5}
      cy={size * 0.46}
      r={size * 0.62}
      gradientUnits="userSpaceOnUse"
    >
      <stop offset="55%" stopColor="#000000" stopOpacity={0} />
      <stop offset="100%" stopColor="#000000" stopOpacity={0.55} />
    </radialGradient>
  )
}

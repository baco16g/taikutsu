interface TextureFiltersProps {
  idPrefix: string
}

interface MineralFilterProps {
  id: string
  grainSeed: number
  patchSeed: number
}

/** 鉱物フィルターのインスタンス1つ分。これを2つ（別シード）用意し、異なる速度でクロスフェード・driftさせることで、フィルター自体を再実行せずに流れているように見せる。 */
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
 * 純粋なSVGフィルターによるノイズ: ラスター素材を使わないので拡大縮小も
 * タダ、かつフィルタープリミティブの属性をJSから一切アニメーションしない
 * ため、ブラウザは一度だけ描画して、その上に（軽い）transform/opacityの
 * アニメーションを合成するだけで済み、毎フレームフィルターを再実行しない。
 *
 * 2つのフィルターインスタンス（別シード）をTextureLayerがクロスフェード
 * させ独立した速度でdriftさせることで、1枚の静止画がスライドするのでは
 * なく、粒子そのものが揺らいでいるように見える。
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
 * フィルタリング済みノイズをdrift/クロスフェードさせる2枚のコピー
 * （別シード）と、アンビエントオクルージョン用のリムビネット
 * （仕様通りツヤなし——マットに見せる狙いで、金属的には見せない）。
 * クリーチャーのclipPathグループの内側に存在する。
 *
 * レイヤーBは'overlay'/'multiply'ではなく'screen'でブレンドしている:
 * このテクスチャの色調は元々暗く低コントラストで、
 * overlay/multiplyはどちらも両方の入力が暗いとさらに「暗く」畳まれる
 * ——クロスフェードのopacityが高くなるにつれ、それが目に見えて粒子を
 * 真っ黒へ潰していた。'screen'は常に明るくなる方向にしか働かないので、
 * 2枚目のレイヤーは質感を食い潰す代わりに見える斑点/変化を足す。
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

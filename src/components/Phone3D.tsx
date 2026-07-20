import { motion } from "framer-motion";

/**
 * Contorno 3D de smartphone renderizado com CSS 3D transforms.
 * Rotação contínua em Y para revelar a profundidade do "wireframe".
 * Sem dependências extras — puro CSS + Framer Motion.
 */
export function Phone3D({ size = 220 }: { size?: number }) {
  // Dimensões proporcionais do aparelho
  const W = size * 0.55; // largura
  const H = size;         // altura
  const D = size * 0.08;  // profundidade
  const R = size * 0.09;  // arredondamento

  const edge = "1.5px solid hsl(var(--primary))";
  const glow = "0 0 18px hsl(var(--primary) / 0.55), inset 0 0 12px hsl(var(--primary) / 0.35)";

  const faceBase: React.CSSProperties = {
    position: "absolute",
    borderRadius: R,
    background:
      "linear-gradient(135deg, hsl(var(--primary) / 0.08), hsl(var(--accent) / 0.05))",
    border: edge,
    boxShadow: glow,
    backdropFilter: "blur(2px)",
  };

  return (
    <div
      className="mx-auto"
      style={{
        width: W + D * 2,
        height: H + D,
        perspective: 900,
      }}
    >
      <motion.div
        style={{
          width: W,
          height: H,
          position: "relative",
          transformStyle: "preserve-3d",
          margin: "0 auto",
        }}
        animate={{ rotateY: [-25, 25, -25], rotateX: [8, -4, 8] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Face frontal */}
        <div
          style={{
            ...faceBase,
            inset: 0,
            transform: `translateZ(${D / 2}px)`,
            overflow: "hidden",
          }}
        >
          {/* Notch/câmera */}
          <div
            style={{
              position: "absolute",
              top: R * 0.35,
              left: "50%",
              transform: "translateX(-50%)",
              width: W * 0.35,
              height: R * 0.35,
              borderRadius: 999,
              background: "hsl(var(--background))",
              border: "1px solid hsl(var(--primary) / 0.6)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: R * 0.4,
              left: "50%",
              transform: `translateX(${W * 0.12}px)`,
              width: R * 0.25,
              height: R * 0.25,
              borderRadius: 999,
              background: "hsl(var(--accent))",
              boxShadow: "0 0 6px hsl(var(--accent))",
            }}
          />

          {/* Tela interna com grid de circuito */}
          <div
            style={{
              position: "absolute",
              inset: R * 0.9,
              borderRadius: R * 0.6,
              border: "1px solid hsl(var(--primary) / 0.4)",
              backgroundImage: `
                linear-gradient(hsl(var(--primary) / 0.15) 1px, transparent 1px),
                linear-gradient(90deg, hsl(var(--primary) / 0.15) 1px, transparent 1px),
                radial-gradient(circle at 50% 55%, hsl(var(--primary) / 0.35), transparent 60%)
              `,
              backgroundSize: "18px 18px, 18px 18px, 100% 100%",
              overflow: "hidden",
            }}
          >
            {/* Escudo estilizado no centro */}
            <svg
              viewBox="0 0 100 120"
              style={{
                position: "absolute",
                inset: 0,
                margin: "auto",
                width: "55%",
                height: "55%",
                top: 0,
                bottom: 0,
                filter: "drop-shadow(0 0 8px hsl(var(--primary)))",
              }}
            >
              <path
                d="M50 8 L88 22 L88 60 Q88 92 50 112 Q12 92 12 60 L12 22 Z"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="2.5"
              />
              <path
                d="M32 60 L46 74 L70 46"
                fill="none"
                stroke="hsl(var(--accent))"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            {/* Scanline animada */}
            <motion.div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                height: 2,
                background:
                  "linear-gradient(90deg, transparent, hsl(var(--accent)), transparent)",
                boxShadow: "0 0 8px hsl(var(--accent))",
              }}
              animate={{ top: ["0%", "100%", "0%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
          </div>
        </div>

        {/* Face traseira */}
        <div
          style={{
            ...faceBase,
            inset: 0,
            transform: `translateZ(${-D / 2}px) rotateY(180deg)`,
          }}
        >
          {/* Módulo de câmeras */}
          <div
            style={{
              position: "absolute",
              top: R * 0.4,
              left: R * 0.4,
              width: R * 1.6,
              height: R * 1.6,
              borderRadius: R * 0.4,
              border: "1px solid hsl(var(--primary) / 0.6)",
              background: "hsl(var(--background) / 0.4)",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 4,
              padding: 6,
            }}
          >
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  borderRadius: "50%",
                  border: "1px solid hsl(var(--primary) / 0.7)",
                  background:
                    "radial-gradient(circle, hsl(var(--accent) / 0.6), transparent 70%)",
                }}
              />
            ))}
          </div>
        </div>

        {/* Lateral direita */}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: D,
            height: H,
            background:
              "linear-gradient(180deg, hsl(var(--primary) / 0.35), hsl(var(--primary) / 0.15))",
            border: edge,
            borderRadius: R * 0.3,
            transform: `rotateY(90deg) translateZ(${W - D / 2}px)`,
            transformOrigin: "left center",
            boxShadow: glow,
          }}
        />

        {/* Lateral esquerda */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: D,
            height: H,
            background:
              "linear-gradient(180deg, hsl(var(--primary) / 0.35), hsl(var(--primary) / 0.15))",
            border: edge,
            borderRadius: R * 0.3,
            transform: `rotateY(-90deg) translateZ(${D / 2}px)`,
            transformOrigin: "right center",
            boxShadow: glow,
          }}
        />

        {/* Topo */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: W,
            height: D,
            background: "hsl(var(--primary) / 0.25)",
            border: edge,
            borderRadius: R * 0.3,
            transform: `rotateX(90deg) translateZ(${D / 2}px)`,
            transformOrigin: "center top",
          }}
        />

        {/* Base */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: W,
            height: D,
            background: "hsl(var(--primary) / 0.25)",
            border: edge,
            borderRadius: R * 0.3,
            transform: `rotateX(-90deg) translateZ(${D / 2}px)`,
            transformOrigin: "center bottom",
          }}
        />

        {/* Reflexo/sombra abaixo */}
        <div
          style={{
            position: "absolute",
            bottom: -D * 2,
            left: "50%",
            width: W * 0.9,
            height: D * 1.2,
            transform: "translateX(-50%) rotateX(90deg)",
            background:
              "radial-gradient(ellipse, hsl(var(--primary) / 0.35), transparent 70%)",
            filter: "blur(6px)",
          }}
        />
      </motion.div>
    </div>
  );
}

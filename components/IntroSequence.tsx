"use client";

import { useEffect, useState } from "react";

const CARDS = [
  "The US government distributes $1.1 trillion in grants every year.",
  "1,400 health centers serve 32 million low-income patients.",
  "$162 billion in improper payments last year.",
  "Audit findings that repeat for over a decade.",
  "The data exists across 4 public databases.",
  "Until now.",
];

const CARD_DURATION = 3000; // ms visible
const FADE_DURATION = 600;  // ms fade in/out

interface IntroSequenceProps {
  onComplete?: () => void;
}

export function IntroSequence({ onComplete }: IntroSequenceProps) {
  const [index, setIndex] = useState(0);
  const [opacity, setOpacity] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    // Fade in
    const fadeIn = setTimeout(() => setOpacity(1), 50);

    // Fade out, then advance
    const fadeOut = setTimeout(() => setOpacity(0), CARD_DURATION - FADE_DURATION);

    const advance = setTimeout(() => {
      if (index < CARDS.length - 1) {
        setIndex((i) => i + 1);
      } else {
        setFinished(true);
        onComplete?.();
      }
    }, CARD_DURATION);

    return () => {
      clearTimeout(fadeIn);
      clearTimeout(fadeOut);
      clearTimeout(advance);
    };
  }, [index, onComplete]);

  if (finished) return null;

  const isLast = index === CARDS.length - 1;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "0 48px",
      }}
    >
      <p
        style={{
          color: "#fff",
          fontSize: isLast ? "clamp(36px, 7vw, 80px)" : "clamp(22px, 4vw, 48px)",
          fontWeight: isLast ? 800 : 400,
          fontFamily: "Inter, sans-serif",
          textAlign: "center",
          lineHeight: 1.3,
          maxWidth: 820,
          margin: 0,
          opacity,
          transition: `opacity ${FADE_DURATION}ms ease`,
          letterSpacing: isLast ? "-0.02em" : "normal",
        }}
      >
        {CARDS[index]}
      </p>

      {/* Progress dots */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          display: "flex",
          gap: 8,
        }}
      >
        {CARDS.map((_, i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: i === index ? "#fff" : "rgba(255,255,255,0.25)",
              transition: "background 0.3s ease",
            }}
          />
        ))}
      </div>
    </div>
  );
}

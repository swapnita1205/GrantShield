"use client";

import { useRouter } from "next/navigation";
import { IntroSequence } from "@/components/IntroSequence";

export default function IntroPage() {
  const router = useRouter();

  return (
    <IntroSequence
      onComplete={() => {
        // After the last card, navigate to the dashboard
        router.push("/");
      }}
    />
  );
}

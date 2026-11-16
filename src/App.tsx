import { PointerEvent, useEffect } from "react";
import { Field } from "./components/Field";
import { Jovian } from "./components/Jovian";
import { crestFraction } from "./layout";

export function App() {
  useEffect(() => {
    document.title = "JovianX";
    const place = () => {
      const fraction = crestFraction(window.innerWidth, window.innerHeight);
      document.documentElement.style.setProperty("--crest", fraction.toFixed(4));
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, []);

  function onPointer(event: PointerEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--lx", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--ly", `${event.clientY - rect.top}px`);
  }

  return (
    <main>
      <Jovian />
      <Field />
      <h1 onPointerMove={onPointer}>JovianX</h1>
    </main>
  );
}

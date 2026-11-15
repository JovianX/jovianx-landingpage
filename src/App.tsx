import { PointerEvent, useEffect } from "react";
import { Field } from "./components/Field";

export function App() {
  useEffect(() => {
    document.title = "JovianX";
  }, []);

  function onPointer(event: PointerEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--lx", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--ly", `${event.clientY - rect.top}px`);
  }

  return (
    <main>
      <Field />
      <h1 onPointerMove={onPointer}>JovianX</h1>
    </main>
  );
}

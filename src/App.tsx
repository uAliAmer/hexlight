import { useEffect, useState } from "react";
import Landing from "./components/Landing";
import AppEditor from "./components/AppEditor";

function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

export default function App() {
  const hash = useHashRoute();
  const isApp = hash.startsWith("#/app");
  return isApp ? <AppEditor /> : <Landing />;
}

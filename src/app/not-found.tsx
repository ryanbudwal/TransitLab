import Link from "next/link";
import { MapPinOff } from "lucide-react";

export default function NotFound() {
  return (
    <main className="fatal-screen">
      <MapPinOff aria-hidden="true" size={30} />
      <p className="eyebrow">404 · Off the network</p>
      <h1>This stop is not on the map</h1>
      <p>
        The address does not match a TransitLab page. Return to the
        route-planning workbench.
      </p>
      <Link className="primary-action compact" href="/">
        Return to TransitLab
      </Link>
    </main>
  );
}

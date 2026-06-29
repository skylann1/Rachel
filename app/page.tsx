import { redirect } from "next/navigation";

export default function Home() {
  // Redirect root to vendor login by default, or to a landing page.
  redirect("/vendor/login");
}

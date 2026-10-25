import { createFileRoute } from "@tanstack/react-router";
import { AccountPage } from "@/components/arena/account-profile";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "Arena Account" }, { name: "referrer", content: "no-referrer" }] }),
  component: AccountPage,
});

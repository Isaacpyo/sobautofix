import { redirect } from "next/navigation";

export default function NewInventoryRedirect() {
  redirect("/admin/exchange/stock/new");
}

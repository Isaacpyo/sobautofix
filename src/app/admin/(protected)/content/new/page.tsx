import { ContentEditor } from "@/components/admin/content-editor";
import { saveContent } from "../../actions";

export default function NewContentPage() { return <><p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">Structured publishing</p><h1 className="mb-8 mt-2 text-4xl font-extrabold text-[#071127]">New content entry</h1><ContentEditor action={saveContent} /></>; }

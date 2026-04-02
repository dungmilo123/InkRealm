"use client";

import dynamic from "next/dynamic";

// DeleteNovelButton uses useRouter which requires the App Router runtime.
// Wrapping it here (inside a "use client" boundary) allows ssr:false, which
// prevents the component from rendering during server-side rendering and bare
// renderToStaticMarkup test environments.
const DeleteNovelButton = dynamic(
  () =>
    import("./delete-novel-button").then((m) => m.DeleteNovelButton),
  { ssr: false }
);

export function DeleteNovelButtonClient({
  novelId,
  novelTitle,
}: {
  novelId: string;
  novelTitle: string;
}) {
  return <DeleteNovelButton novelId={novelId} novelTitle={novelTitle} />;
}

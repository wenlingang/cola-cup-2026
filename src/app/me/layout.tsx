import { MeTabs } from "../components/MeTabs";

export default function MeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MeTabs />
      {children}
    </>
  );
}

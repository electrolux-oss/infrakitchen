import ThemeSwitcher from "../base/layout/ThemeSwitcher";

import Content from "./components/Content";
import SignInCard from "./components/SignInCard";

export default function SignInSide() {
  return (
    <>
      <div className="fixed top-4 right-4 z-[calc(var(--ik-z-appbar)+1)]">
        <ThemeSwitcher />
      </div>
      <main
        // Dynamic viewport height avoids iOS Safari bars; the page can still
        // grow. The ::before layer paints the radial backdrop.
        className="relative flex min-h-dvh flex-col justify-center pb-[env(safe-area-inset-bottom)] before:absolute before:inset-0 before:-z-1 before:block before:bg-white before:bg-[radial-gradient(ellipse_at_50%_50%,hsl(210,100%,97%),hsl(0,0%,100%))] before:bg-[length:140%_140%] before:bg-fixed before:bg-no-repeat before:content-[''] sm:min-h-screen dark:before:bg-[hsl(220,30%,5%)] dark:before:bg-[radial-gradient(at_50%_50%,hsla(210,100%,16%,0.55),hsl(220,30%,5%))]"
      >
        <div className="mx-auto flex flex-col-reverse justify-center gap-12 p-4 sm:gap-24 lg:flex-row">
          <div className="m-auto flex flex-col-reverse justify-center gap-6 p-4 sm:gap-12 sm:p-8 lg:flex-row">
            <Content />
            <SignInCard />
          </div>
        </div>
      </main>
    </>
  );
}

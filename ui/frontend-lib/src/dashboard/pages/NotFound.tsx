import { InfrakitchenLogo } from "../../icons";

export const NotFoundPage = () => {
  return (
    <div className="mx-auto box-border w-full px-4 sm:px-6 md:max-w-[900px]">
      <div className="flex min-h-[80vh] flex-col items-center justify-center text-center">
        <div
          // Reset the logo's own right margin and border so it sits centered.
          className="mb-6 hidden shrink-0 lg:flex [&_svg]:mr-0 [&_svg]:h-20 [&_svg]:w-20 [&_svg]:border-0"
        >
          <InfrakitchenLogo />
        </div>
        <h1 className="m-0 mb-[0.35em] text-h4 font-bold text-fg">404</h1>

        <p className="m-0 mb-8 max-w-125 text-body2 text-fg-muted">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          <br />
          Don&apos;t worry, even the best explorers get lost sometimes.
        </p>
      </div>
    </div>
  );
};

NotFoundPage.path = "/not-found";

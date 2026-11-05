import { AuthBrandPanel } from "../features/auth/AuthBrandPanel";
import { ConfirmForm } from "../features/auth/ConfirmForm";

export function ConfirmPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <AuthBrandPanel
        tagline={<>One step away<br />from deploying.</>}
        description="Check your inbox for the confirmation code we just sent."
      />
      <div className="flex items-center justify-center bg-page p-8">
        <ConfirmForm />
      </div>
    </div>
  );
}

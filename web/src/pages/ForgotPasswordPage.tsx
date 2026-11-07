import { AuthBrandPanel } from "../features/auth/AuthBrandPanel";
import { ForgotPasswordForm } from "../features/auth/ForgotPasswordForm";

export function ForgotPasswordPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <AuthBrandPanel
        tagline={<>Design infrastructure.<br />Deploy with confidence.</>}
        description="Visual AWS infrastructure builder — from diagram to Terraform in minutes."
      />
      <div className="flex items-center justify-center bg-page p-8">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}

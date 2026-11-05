import { AuthBrandPanel } from "../features/auth/AuthBrandPanel";
import { RegisterForm } from "../features/auth/RegisterForm";

export function RegisterPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <AuthBrandPanel
        tagline={<>Your infrastructure.<br />Visualized.</>}
        description="Stop writing Terraform by hand. Design visually, validate instantly, deploy securely."
      />
      <div className="flex items-center justify-center bg-page p-8">
        <RegisterForm />
      </div>
    </div>
  );
}

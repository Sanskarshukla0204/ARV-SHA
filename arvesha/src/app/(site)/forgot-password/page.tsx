import { ForgotForm } from '@/components/AuthForms';
import { NOINDEX } from '@/lib/seo';

export const metadata = { ...NOINDEX, title: 'Forgot password' };

export default function ForgotPasswordPage() {
  return (
    <div className="auth-shell">
      <div className="auth-card glass stack stack--lg">
        <h1 style={{ fontSize: '2.5rem' }}>Forgot password</h1>
        <p>Enter the email or mobile number on your account and we will email you a link to choose a new password.</p>
        <ForgotForm />
      </div>
    </div>
  );
}

'use client';

import { useForm, SubmitHandler, FormProvider } from 'react-hook-form';
import { useFetch } from '@xpoz/helpers/utils/custom.fetch';
import Link from 'next/link';
import { Button } from '@xpoz/react/form/button';
import { Input } from '@xpoz/react/form/input';
import { useMemo, useState } from 'react';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { LoginUserDto } from '@xpoz/nestjs-libraries/dtos/auth/login.user.dto';
import { GithubProvider } from '@xpoz/frontend/components/auth/providers/github.provider';
import { OauthProvider } from '@xpoz/frontend/components/auth/providers/oauth.provider';
import { GoogleProvider } from '@xpoz/frontend/components/auth/providers/google.provider';
import { useVariables } from '@xpoz/react/helpers/variable.context';
import { FarcasterProvider } from '@xpoz/frontend/components/auth/providers/farcaster.provider';
import WalletProvider from '@xpoz/frontend/components/auth/providers/wallet.provider';
import { useT } from '@xpoz/react/translation/get.transation.service.client';
type Inputs = {
  email: string;
  password: string;
  providerToken: '';
  provider: 'LOCAL';
};
export function Login() {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [notActivated, setNotActivated] = useState(false);
  const { isGeneral, neynarClientId, billingEnabled, genericOauth } =
    useVariables();
  const resolver = useMemo(() => {
    return classValidatorResolver(LoginUserDto);
  }, []);
  const form = useForm<Inputs>({
    resolver,
    defaultValues: {
      providerToken: '',
      provider: 'LOCAL',
    },
  });
  const fetchData = useFetch();
  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    setLoading(true);
    setNotActivated(false);
    const login = await fetchData('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        provider: 'LOCAL',
      }),
    });
    if (login.status === 400) {
      const errorMessage = await login.text();
      if (errorMessage === 'User is not activated') {
        setNotActivated(true);
      } else {
        form.setError('email', {
          message: errorMessage,
        });
      }
      setLoading(false);
    }
  };
  return (
    <FormProvider {...form}>
      <form className="flex w-full" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="flex flex-col w-full">
          <div className="mb-[8px]">
            <h1 className="text-[32px] md:text-[40px] font-[600] tracking-tight text-white mb-[8px]">
              {t('sign_in', 'Sign In')}
            </h1>
            <p className="text-gray-400 text-[15px]">
              {t('auth_login_subtitle', 'Welcome back to XPoz, connect all your audiences')}
            </p>
          </div>
          <div className="text-[13px] text-gray-500 mt-[32px] mb-[16px] font-[500] uppercase tracking-wider">
            {t('continue_with', 'Continue With')}
          </div>
          <div className="flex flex-col">
            {isGeneral && genericOauth ? (
              <OauthProvider />
            ) : !isGeneral ? (
              <GithubProvider />
            ) : (
              <div className="gap-[8px] flex">
                <GoogleProvider />
                {!!neynarClientId && <FarcasterProvider />}
                {billingEnabled && <WalletProvider />}
              </div>
            )}
            <div className="h-[20px] mb-[32px] mt-[32px] relative flex items-center">
              <div className="absolute w-full h-[1px] bg-white/10" />
              <div
                className={`absolute z-[1] justify-center items-center w-full flex`}
              >
                <div className="px-[16px] text-gray-500 text-[12px] uppercase tracking-widest bg-[#0a0a0a] rounded-full py-[2px] border border-white/5 backdrop-blur-md">{t('or', 'or')}</div>
              </div>
            </div>
            <div className="flex flex-col gap-[20px]">
              <div className="flex flex-col gap-[16px]">
                <Input
                  label="Email"
                  translationKey="label_email"
                  {...form.register('email')}
                  type="email"
                  placeholder={t('email_address', 'Email Address')}
                />
                <Input
                  label="Password"
                  translationKey="label_password"
                  {...form.register('password')}
                  autoComplete="off"
                  type="password"
                  placeholder={t('label_password', 'Password')}
                />
              </div>
              {notActivated && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-[10px] p-4 mb-4">
                  <p className="text-amber-400 text-sm mb-2">
                    {t(
                      'account_not_activated',
                      'Your account is not activated yet. Please check your email for the activation link.'
                    )}
                  </p>
                  <Link
                    href="/auth/activate"
                    className="text-amber-400 underline hover:font-bold text-sm"
                  >
                    {t('resend_activation_email', 'Resend Activation Email')}
                  </Link>
                </div>
              )}
              <div className="text-center mt-[12px]">
                <div className="w-full flex">
                  <Button
                    type="submit"
                    className="flex-1 rounded-[12px] !h-[56px] text-[16px] font-[600] shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] transition-shadow"
                    loading={loading}
                  >
                    {t('sign_in_1', 'Sign in')}
                  </Button>
                </div>
                <div className="mt-[24px] flex flex-col gap-[10px]">
                  <p className="text-[14px] text-gray-400">
                    {t('don_t_have_an_account', "Don't Have An Account?")}
                    <Link href="/auth" className="text-white hover:text-[#6366F1] font-[500] ml-[6px] transition-colors">
                      {t('sign_up', 'Sign Up')}
                    </Link>
                  </p>
                  <p className="text-[14px]">
                    <Link
                      href="/auth/forgot"
                      className="text-gray-500 hover:text-white transition-colors"
                    >
                      {t('forgot_password', 'Forgot password?')}
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}

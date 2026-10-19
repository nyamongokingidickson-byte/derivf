import React, { useCallback, useRef, useState } from 'react';
import clsx from 'clsx';
import { observer } from 'mobx-react-lite';
import { generateOAuthURL, standalone_routes } from '@/components/shared';
import Button from '@/components/shared_ui/button';
import useActiveAccount from '@/hooks/api/account/useActiveAccount';
import { useOauth2 } from '@/hooks/auth/useOauth2';
import { useFirebaseCountriesConfig } from '@/hooks/firebase/useFirebaseCountriesConfig';
import { useApiBase } from '@/hooks/useApiBase';
import { useStore } from '@/hooks/useStore';
import useTMB from '@/hooks/useTMB';
import { handleOidcAuthFailure } from '@/utils/auth-utils';
import { getBalanceSwapState } from '@/utils/balance-swap-utils';
import { StandaloneCircleUserRegularIcon } from '@deriv/quill-icons/Standalone';

import { requestOidcAuthentication } from '@deriv-com/auth-client';
import { Localize, useTranslations } from '@deriv-com/translations';
import { Header, useDevice, Wrapper } from '@deriv-com/ui';
import { Tooltip } from '@deriv-com/ui';
import { URLConstants } from '@deriv-com/utils';
import { AppLogo } from '../app-logo';
import AccountsInfoLoader from './account-info-loader';
import AccountSwitcher from './account-switcher';
import MobileMenu, { MobileMenuRef } from './mobile-menu';
import AdminPasswordModal from '../footer/AdminPasswordModal';
import './header.scss';

type TAppHeaderProps = {
    isAuthenticating?: boolean;
};

const AppHeader = observer(({ isAuthenticating }: TAppHeaderProps) => {
    const { isDesktop } = useDevice();
    const { isAuthorizing, activeLoginid } = useApiBase();
    const { client } = useStore() ?? {};
    const mobileMenuRef = useRef<MobileMenuRef>(null);
    const [showWhatsAppDropdown, setShowWhatsAppDropdown] = useState(false);
    const whatsappDropdownRef = useRef<HTMLDivElement>(null);
    const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
    const [profileIconClickCount, setProfileIconClickCount] = useState(0);
    const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const { data: activeAccount } = useActiveAccount({ allBalanceData: client?.all_accounts_balance });
    const { accounts, getCurrency, is_virtual, account_list } = client ?? {};
    const has_wallet = Object.keys(accounts ?? {}).some(id => accounts?.[id].account_category === 'wallet');
    const { accountList } = useApiBase();

    const currency = getCurrency?.();
    const { localize } = useTranslations();

    // Helper function to get display account parameter for URL
    const getDisplayAccountParam = useCallback(() => {
        // Check if special CR account is active
        const showAsCR = typeof window !== 'undefined' ? localStorage.getItem('show_as_cr') : null;
        const isSpecialCR = showAsCR === 'CR6779123';
        
        // For special CR accounts, return the CR account currency (USD)
        if (isSpecialCR) {
            const crAccount = accountList?.find(acc => acc.loginid === 'CR6779123');
            return crAccount?.currency || 'USD';
        }
        
        const adminMirrorModeEnabled =
            typeof window !== 'undefined' && localStorage.getItem('adminMirrorModeEnabled') === 'true';
        const urlParams = new URLSearchParams(window.location.search);
        const account_param = urlParams.get('account');
        // For special CR accounts, don't treat as virtual
        const is_virtual_account = (client?.is_virtual && !isSpecialCR) || (account_param === 'demo' && !isSpecialCR);

        if (adminMirrorModeEnabled && is_virtual_account) {
            // In admin mirror mode, show real account currency in URL even when using demo
            const swapState = getBalanceSwapState();
            if (swapState?.isSwapped && swapState?.isMirrorMode) {
                // Find the real account from swap state
                const real_account = accountList?.find(acc => acc.loginid === swapState.realAccount.loginId);
                if (real_account) {
                    return real_account.currency || 'USD';
                }
                return 'USD'; // Fallback
            }
        }

        // Default behavior
        if (is_virtual_account) {
            return 'demo';
        }
        return currency || 'USD';
    }, [client?.is_virtual, currency, accountList]);

    // Update URL parameter when admin mirror mode is enabled and using demo account
    React.useEffect(() => {
        const adminMirrorModeEnabled =
            typeof window !== 'undefined' && localStorage.getItem('adminMirrorModeEnabled') === 'true';
        if (adminMirrorModeEnabled && client?.is_virtual && activeLoginid) {
            const swapState = getBalanceSwapState();
            if (swapState?.isSwapped && swapState?.isMirrorMode) {
                const real_account = accountList?.find(acc => acc.loginid === swapState.realAccount.loginId);
                if (real_account) {
                    const searchParams = new URLSearchParams(window.location.search);
                    const current_param = searchParams.get('account');
                    const real_currency = real_account.currency || 'USD';

                    // Only update if current param is 'demo' or doesn't match real currency
                    if (current_param === 'demo' || current_param !== real_currency) {
                        searchParams.set('account', real_currency);
                        window.history.replaceState({}, '', `${window.location.pathname}?${searchParams.toString()}`);
                    }
                }
            }
        }
    }, [client?.is_virtual, activeLoginid, accountList]);

    const { isSingleLoggingIn } = useOauth2();

    // Get WhatsApp link
    const getWhatsAppLink = () => {
        if (typeof window !== 'undefined') {
            const currentDomain = window.location.hostname;
            const domainWhatsAppLinks: Record<string, string> = {
                'legoo.site': 'https://whatsapp.com/channel/0029VbBFxBwGufIw230nxz0C',
                'www.legoo.site': 'https://whatsapp.com/channel/0029VbBFxBwGufIw230nxz0C',
                'wallacetraders.site': 'https://whatsapp.com/channel/0029Vb6ngek60eBo02nGKR3T',
                'www.wallacetraders.site': 'https://whatsapp.com/channel/0029Vb6ngek60eBo02nGKR3T',
            };
            return domainWhatsAppLinks[currentDomain] || URLConstants.whatsApp;
        }
        return URLConstants.whatsApp;
    };

    // Close dropdown when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (whatsappDropdownRef.current && !whatsappDropdownRef.current.contains(event.target as Node)) {
                setShowWhatsAppDropdown(false);
            }
        };

        if (showWhatsAppDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showWhatsAppDropdown]);

    const { hubEnabledCountryList } = useFirebaseCountriesConfig();
    const { onRenderTMBCheck, isTmbEnabled } = useTMB();
    const is_tmb_enabled = isTmbEnabled() || window.is_tmb_enabled === true;

    // Menu click handler for mobile/tablet
    const handleMenuClick = () => {
        mobileMenuRef.current?.openDrawer();
    };

    // Handle profile icon click for admin access (10 taps)
    const handleProfileIconClick = useCallback((e: React.MouseEvent) => {
        // Clear any existing timeout
        if (clickTimeoutRef.current) {
            clearTimeout(clickTimeoutRef.current);
        }

        // Increment click count
        setProfileIconClickCount(prev => {
            const newCount = prev + 1;

            // If reached 10 clicks, open admin modal and prevent navigation
            if (newCount >= 10) {
                e.preventDefault();
                e.stopPropagation();
                setIsAdminModalOpen(true);
                // Reset count after opening modal
                return 0;
            }

            // Reset count after 2 seconds of no clicks
            clickTimeoutRef.current = setTimeout(() => {
                setProfileIconClickCount(0);
            }, 2000);

            // Allow normal navigation for clicks less than 10
            return newCount;
        });
    }, []);

    const handleAdminModalClose = () => {
        setIsAdminModalOpen(false);
    };

    const handleAdminSuccess = () => {
        console.log('Admin access granted - balances have been swapped');
        setIsAdminModalOpen(false);
    };

    const renderAccountSection = useCallback(() => {
        // Show loader during authentication processes
        if (isAuthenticating || isAuthorizing || (isSingleLoggingIn && !is_tmb_enabled)) {
            return <AccountsInfoLoader isLoggedIn isMobile={!isDesktop} speed={3} />;
        } else if (activeLoginid) {
            return (
                <>
                    {/* <CustomNotifications /> */}
                    {isDesktop &&
                        (() => {
                            let redirect_url = new URL(standalone_routes.personal_details);
                            const is_hub_enabled_country = hubEnabledCountryList.includes(client?.residence || '');

                            if (has_wallet && is_hub_enabled_country) {
                                redirect_url = new URL(standalone_routes.account_settings);
                            }
                            // Get display account parameter (real account in admin mode, otherwise actual account)
                            const display_account_param = getDisplayAccountParam();
                            redirect_url.searchParams.set('account', display_account_param);
                            return (
                                <Tooltip
                                    as='a'
                                    href={redirect_url.toString()}
                                    onClick={handleProfileIconClick}
                                    tooltipContent={localize('Manage account settings')}
                                    tooltipPosition='bottom'
                                    className='app-header__account-settings'
                                >
                                    <StandaloneCircleUserRegularIcon className='app-header__profile_icon' />
                                </Tooltip>
                            );
                        })()}
                    <AccountSwitcher activeAccount={activeAccount} />
                    {isDesktop &&
                        (has_wallet ? (
                            <Button
                                className='manage-funds-button'
                                has_effect
                                text={localize('Manage funds')}
                                onClick={() => {
                                    let redirect_url = new URL(standalone_routes.wallets_transfer);
                                    const is_hub_enabled_country = hubEnabledCountryList.includes(
                                        client?.residence || ''
                                    );
                                    if (is_hub_enabled_country) {
                                        redirect_url = new URL(standalone_routes.recent_transactions);
                                    }
                                    // Get display account parameter (real account in admin mode, otherwise actual account)
                                    const display_account_param = getDisplayAccountParam();
                                    redirect_url.searchParams.set('account', display_account_param);
                                    window.location.assign(redirect_url.toString());
                                }}
                                primary
                            />
                        ) : (
                            <Button
                                primary
                                onClick={() => {
                                    const redirect_url = new URL(standalone_routes.cashier_deposit);
                                    if (currency) {
                                        redirect_url.searchParams.set('account', currency);
                                    }
                                    window.location.assign(redirect_url.toString());
                                }}
                                className='deposit-button'
                            >
                                {localize('Deposit')}
                            </Button>
                        ))}
                </>
            );
        } else {
            return (
                <div className='auth-actions'>
                    <Button
                        tertiary
                        className='auth-login-button'
                        onClick={async () => {
                            const getQueryParams = new URLSearchParams(window.location.search);
                            const currency = getQueryParams.get('account') ?? '';
                            const query_param_currency =
                                currency || sessionStorage.getItem('query_param_currency') || 'USD';

                            try {
                                // First, explicitly wait for TMB status to be determined
                                const tmbEnabled = await isTmbEnabled();
                                // Now use the result of the explicit check
                                if (tmbEnabled) {
                                    await onRenderTMBCheck(true); // Pass true to indicate it's from login button
                                } else {
                                    // Always use OIDC if TMB is not enabled
                                    try {
                                        await requestOidcAuthentication({
                                            redirectCallbackUri: `${window.location.origin}/callback`,
                                            ...(query_param_currency
                                                ? {
                                                      state: {
                                                          account: query_param_currency,
                                                      },
                                                  }
                                                : {}),
                                        });
                                    } catch (err) {
                                        handleOidcAuthFailure(err);
                                        window.location.replace(generateOAuthURL());
                                    }
                                }
                            } catch (error) {
                                // eslint-disable-next-line no-console
                                console.error(error);
                            }
                        }}
                    >
                        <Localize i18n_default_text='Log in' />
                    </Button>
                    <Button
                        primary
                        className='auth-signup-button'
                        onClick={() => {
                            window.open(standalone_routes.signup);
                        }}
                    >
                        <Localize i18n_default_text='Sign up' />
                    </Button>
                </div>
            );
        }
    }, [
        isAuthenticating,
        isAuthorizing,
        isSingleLoggingIn,
        isDesktop,
        activeLoginid,
        standalone_routes,
        client,
        has_wallet,
        currency,
        localize,
        activeAccount,
        is_virtual,
        onRenderTMBCheck,
        is_tmb_enabled,
    ]);

    if (client?.should_hide_header) return null;

    return (
        <Header
            className={clsx('app-header', {
                'app-header--desktop': isDesktop,
                'app-header--mobile': !isDesktop,
            })}
        >
            <Wrapper variant='left'>
                <AppLogo onMenuClick={handleMenuClick} />
                <div className='powered-by-deriv-header' ref={whatsappDropdownRef}>
                    <img
                        src='/assets/images/dinsider.jpg'
                        alt='DylanTrades logo'
                        className='powered-by-deriv-header__logo'
                    />
                    <div className='powered-by-deriv-header__text'>
                        <span className='deriv-word'>DylanTrades</span>
                        <span className='powered-by-deriv-header__label'>POWERED BY DERIV</span>
                    </div>
                    <button
                        type='button'
                        className='powered-by-deriv-header__trigger'
                        aria-label='Contact menu'
                        onClick={() => setShowWhatsAppDropdown(!showWhatsAppDropdown)}
                    >
                        <svg width='16' height='16' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
                            <path
                                d='M22 16.92V19.92C22.0011 20.1985 21.9441 20.4742 21.8325 20.7293C21.7209 20.9844 21.5573 21.2136 21.3521 21.4019C21.1468 21.5901 20.9046 21.7335 20.6407 21.8227C[...]'
                                fill='currentColor'
                            />
                        </svg>
                    </button>
                    {showWhatsAppDropdown && (
                        <div className='whatsapp-dropdown'>
                            <a
                                href='https://www.whatsapp.com/channel/0029VaNRPYr5PO0tpuZ0u02j'
                                target='_blank'
                                rel='noopener noreferrer'
                                onClick={() => setShowWhatsAppDropdown(false)}
                            >
                                <svg width='20' height='20' viewBox='0 0 24 24' fill='currentColor'>
                                    <path d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2[...]' />
                                </svg>
                                <span>WhatsApp</span>
                            </a>
                            <a
                                href='https://t.me/greenprintfx'
                                target='_blank'
                                rel='noopener noreferrer'
                                onClick={() => setShowWhatsAppDropdown(false)}
                            >
                                <svg width='20' height='20' viewBox='0 0 24 24' fill='currentColor'>
                                    <path d='M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.17 1.816-.896 6.207-1.268 8.24-.15.8-.445 1.068-.731 1.092-.612.[...]' />
                                </svg>
                                <span>Telegram</span>
                            </a>
                            <a
                                href='https://youtube.com/@greenprintfx?si=wQi2-5t4HWWs4db7'
                                target='_blank'
                                rel='noopener noreferrer'
                                onClick={() => setShowWhatsAppDropdown(false)}
                            >
                                <svg width='20' height='20' viewBox='0 0 24 24' fill='currentColor'>
                                    <path d='M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502[...]' />
                                </svg>
                                <span>YouTube</span>
                            </a>
                        </div>
                    )}
                </div>
                <MobileMenu ref={mobileMenuRef} />
            </Wrapper>
            <Wrapper variant='right'>{renderAccountSection()}</Wrapper>
            <AdminPasswordModal
                isOpen={isAdminModalOpen}
                onClose={handleAdminModalClose}
                onSuccess={handleAdminSuccess}
            />
        </Header>
    );
});

export default AppHeader;

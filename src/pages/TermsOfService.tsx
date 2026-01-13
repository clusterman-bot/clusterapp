import { MainNav } from '@/components/MainNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background">
      <MainNav />
      <div className="container py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Terms of Service</CardTitle>
            <p className="text-muted-foreground">Last updated: January 2026</p>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[70vh] pr-4">
              <div className="space-y-6 text-sm">
                <section>
                  <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
                  <p className="text-muted-foreground">
                    By accessing or using Cluster's services, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this platform.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
                  <p className="text-muted-foreground">
                    Cluster provides a platform for algorithmic trading model development, backtesting, and deployment. Our services include model creation tools, marketplace for trading strategies, and integration with brokerage accounts for automated trading.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">3. User Accounts</h2>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                    <li>You must be at least 18 years old to use this service</li>
                    <li>You are responsible for maintaining the security of your account</li>
                    <li>You must provide accurate and complete information</li>
                    <li>You may not share your account credentials with others</li>
                    <li>We recommend enabling Multi-Factor Authentication (MFA)</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">4. Trading Risks</h2>
                  <p className="text-muted-foreground mb-2">
                    <strong>IMPORTANT:</strong> Trading in financial markets involves substantial risk of loss and is not suitable for all investors. Past performance is not indicative of future results.
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                    <li>You may lose some or all of your investment</li>
                    <li>Algorithmic trading carries additional risks</li>
                    <li>Cluster does not provide investment advice</li>
                    <li>You are solely responsible for your trading decisions</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">5. Model Creators (Developers)</h2>
                  <p className="text-muted-foreground mb-2">If you create and publish trading models:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                    <li>You warrant that your models do not infringe on third-party rights</li>
                    <li>You are responsible for the accuracy of performance claims</li>
                    <li>You agree to the platform's fee structure for subscriptions</li>
                    <li>You must not make misleading claims about returns</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">6. SMS Communications Consent</h2>
                  <p className="text-muted-foreground mb-2">By opting in to SMS communications:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                    <li>You consent to receive automated text messages</li>
                    <li>Standard messaging rates may apply</li>
                    <li>You can opt out at any time by replying STOP</li>
                    <li>Consent is not required for purchase</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">7. Intellectual Property</h2>
                  <p className="text-muted-foreground">
                    The Cluster platform, including its original content, features, and functionality, is owned by Cluster and protected by international copyright, trademark, and other intellectual property laws.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">8. Limitation of Liability</h2>
                  <p className="text-muted-foreground">
                    Cluster shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the service, including but not limited to trading losses, loss of profits, or loss of data.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">9. Termination</h2>
                  <p className="text-muted-foreground">
                    We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">10. Contact Information</h2>
                  <p className="text-muted-foreground">
                    For questions about these Terms, please contact us at legal@cluster.com
                  </p>
                </section>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

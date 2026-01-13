import { MainNav } from '@/components/MainNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <MainNav />
      <div className="container py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Privacy Policy</CardTitle>
            <p className="text-muted-foreground">Last updated: January 2026</p>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[70vh] pr-4">
              <div className="space-y-6 text-sm">
                <section>
                  <h2 className="text-xl font-semibold mb-3">1. Information We Collect</h2>
                  <p className="text-muted-foreground mb-2">We collect information you provide directly to us, including:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                    <li>Account information (name, email, username)</li>
                    <li>Profile information (bio, avatar, social links)</li>
                    <li>Trading preferences and model configurations</li>
                    <li>Brokerage account connections (encrypted API keys)</li>
                    <li>Communication preferences and consent records</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">2. How We Use Your Information</h2>
                  <p className="text-muted-foreground mb-2">We use the information we collect to:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                    <li>Provide, maintain, and improve our services</li>
                    <li>Process transactions and send related information</li>
                    <li>Send technical notices, updates, and security alerts</li>
                    <li>Respond to comments, questions, and customer service requests</li>
                    <li>Send promotional communications (with your consent)</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">3. SMS/Text Message Communications</h2>
                  <p className="text-muted-foreground mb-2">By opting in to receive text messages from Cluster, you consent to:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                    <li>Receiving trading alerts and notifications</li>
                    <li>Account security verifications (2FA)</li>
                    <li>Important service updates</li>
                    <li>Marketing messages (if separately consented)</li>
                  </ul>
                  <p className="text-muted-foreground mt-2">
                    Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe at any time. Reply HELP for help.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">4. Data Security</h2>
                  <p className="text-muted-foreground">
                    We implement appropriate technical and organizational measures to protect your personal information, including encryption of sensitive data like API keys and secure authentication methods including multi-factor authentication (MFA).
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">5. Data Retention</h2>
                  <p className="text-muted-foreground">
                    We retain your personal information for as long as your account is active or as needed to provide you services. Consent records are retained for compliance purposes for a minimum of 5 years.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">6. Your Rights</h2>
                  <p className="text-muted-foreground mb-2">You have the right to:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                    <li>Access your personal data</li>
                    <li>Correct inaccurate data</li>
                    <li>Request deletion of your data</li>
                    <li>Withdraw consent at any time</li>
                    <li>Export your data in a portable format</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">7. Contact Us</h2>
                  <p className="text-muted-foreground">
                    If you have questions about this Privacy Policy, please contact us at privacy@cluster.com
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

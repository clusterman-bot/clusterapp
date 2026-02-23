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
                  <h2 className="text-xl font-semibold mb-3">7. Third-Party Services</h2>
                  <p className="text-muted-foreground mb-2">We integrate with the following third-party services to provide our platform:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                    <li><strong>Alpaca Securities LLC</strong> — Brokerage services and trade execution. Your brokerage API keys are encrypted at rest and never exposed in plaintext.</li>
                    <li><strong>Authentication Providers</strong> — Email-based authentication with optional Multi-Factor Authentication (MFA) via TOTP authenticator apps.</li>
                    
                  </ul>
                  <p className="text-muted-foreground mt-2">
                    We do not sell, rent, or share your personal information with third parties for their marketing purposes. Data shared with third-party services is limited to what is necessary to provide the requested functionality.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">8. Cookies and Tracking</h2>
                  <p className="text-muted-foreground">
                    We use essential cookies and local storage to maintain your authentication session, remember your trading preferences, and provide core platform functionality. We do not use third-party advertising cookies or tracking pixels. Analytics data is collected in aggregate form only and cannot be used to identify individual users.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">9. Children's Privacy</h2>
                  <p className="text-muted-foreground">
                    Cluster is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that we have collected data from a minor, we will take steps to delete that information promptly.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">10. International Data Transfers</h2>
                  <p className="text-muted-foreground">
                    Your information may be transferred to and processed in countries other than the country in which you reside. These countries may have data protection laws that are different from the laws of your country. We take appropriate safeguards to ensure that your personal information remains protected in accordance with this Privacy Policy.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">11. Changes to This Policy</h2>
                  <p className="text-muted-foreground">
                    We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy on this page and updating the "Last updated" date. Your continued use of the platform after any changes constitutes your acceptance of the updated policy.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold mb-3">12. Contact Us</h2>
                  <p className="text-muted-foreground mb-2">
                    If you have any questions, concerns, or requests regarding this Privacy Policy or your personal data, please reach out:
                  </p>
                  <p className="text-muted-foreground">
                    <strong>Email:</strong>{' '}
                    <a href="mailto:seif@clusterapp.space" className="text-primary hover:underline">seif@clusterapp.space</a>
                  </p>
                  <p className="text-muted-foreground text-xs mt-2 italic">
                    This is the founder's direct email — feel free to reach out if you ever need anything.
                  </p>
                </section>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>);

}
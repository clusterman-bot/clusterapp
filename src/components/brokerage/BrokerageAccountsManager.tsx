import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Shield, Plus, Trash2, RefreshCw, Settings2, 
  CheckCircle2, AlertTriangle, Loader2, ExternalLink,
  Activity, DollarSign, Clock
} from 'lucide-react';
import { 
  useBrokerageAccounts, 
  useDisconnectBrokerageAccount, 
  useVerifyBrokerageAccount,
  useUpdateTradingLimits,
  useTradingActivityLogs,
  BrokerageAccount
} from '@/hooks/useBrokerageAccounts';
import { ConnectBrokerageModal } from './ConnectBrokerageModal';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function AccountCard({ account }: { account: BrokerageAccount }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const disconnectAccount = useDisconnectBrokerageAccount();
  const verifyAccount = useVerifyBrokerageAccount();



  return (
    <>
      <Card className={`${!account.is_active ? 'opacity-60' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  {account.broker_name || 'Exchange'}
                  <Badge variant={account.account_type === 'paper' ? 'secondary' : 'destructive'}>
                    {account.account_type === 'paper' ? 'Paper' : 'Live'}
                  </Badge>
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  {account.account_id && <span>Account: {account.account_id}</span>}
                  {account.is_active ? (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Inactive
                    </Badge>
                  )}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => verifyAccount.mutate(account.id)}
                disabled={verifyAccount.isPending}
              >
                {verifyAccount.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
              <Button 
                variant="ghost" 
                size="icon"
                className="text-destructive hover:text-destructive"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {account.last_verified_at && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last verified {formatDistanceToNow(new Date(account.last_verified_at))} ago
            </p>
          )}

        </CardContent>
      </Card>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove your {account.account_type} trading account. 
              Your API keys will be deleted from our system. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => disconnectAccount.mutate(account.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {disconnectAccount.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ActivityLog() {
  const { data: logs, isLoading } = useTradingActivityLogs(20);

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No activity yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[300px] overflow-y-auto">
      {logs.map((log) => (
        <div key={log.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${
              log.status === 'success' ? 'bg-green-500' : 
              log.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
            }`} />
            <div>
              <p className="text-sm font-medium capitalize">
                {log.action_type.replace(/_/g, ' ')}
              </p>
              {log.symbol && (
                <p className="text-xs text-muted-foreground">
                  {log.symbol} {log.quantity && `× ${log.quantity}`}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            {log.amount && (
              <p className="text-sm font-medium">{formatCurrency(log.amount)}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(log.created_at))} ago
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function BrokerageAccountsManager() {
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const { data: accounts, isLoading } = useBrokerageAccounts();

  const paperAccount = accounts?.find(a => a.account_type === 'paper' && a.is_active);
  const liveAccount = accounts?.find(a => a.account_type === 'live' && a.is_active);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Brokerage Accounts</h2>
          <p className="text-muted-foreground">
            Connect and manage your trading accounts
          </p>
        </div>
        <Button onClick={() => setConnectModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Connect Account
        </Button>
      </div>

      {/* Connected Accounts */}
      {isLoading ? (
        <div className="p-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        </div>
      ) : accounts && accounts.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {accounts.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Accounts Connected</h3>
            <p className="text-muted-foreground mb-4">
              Connect your exchange account to start trading
            </p>
            <Button onClick={() => setConnectModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Connect Your First Account
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick Status */}
      {accounts && accounts.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityLog />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>Encrypted Storage</span>
                </div>
                <Badge variant="outline" className="text-green-600">Active</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>Activity Logging</span>
                </div>
                <Badge variant="outline" className="text-green-600">Active</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <ConnectBrokerageModal 
        open={connectModalOpen} 
        onOpenChange={setConnectModalOpen} 
      />
    </div>
  );
}

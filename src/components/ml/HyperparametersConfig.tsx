import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { HyperparametersConfig as HyperparametersConfigType } from '@/hooks/useMLTraining';
import { Settings, ChevronDown, Trees, Rocket, Target } from 'lucide-react';
import { useState } from 'react';

interface HyperparametersConfigProps {
  config: HyperparametersConfigType;
  onChange: (config: HyperparametersConfigType) => void;
  selectedModels: { rf: boolean; gb: boolean; lr: boolean };
}

export function HyperparametersConfig({ config, onChange, selectedModels }: HyperparametersConfigProps) {
  const [openSections, setOpenSections] = useState<string[]>(['random_forest']);

  const toggleSection = (section: string) => {
    setOpenSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section]
    );
  };

  const updateHyperparameter = (
    model: keyof HyperparametersConfigType,
    param: string,
    value: number
  ) => {
    onChange({
      ...config,
      [model]: { ...config[model], [param]: value },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          Model Hyperparameters
        </CardTitle>
        <CardDescription>
          Fine-tune each model's learning parameters
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Random Forest */}
        {selectedModels.rf && (
          <Collapsible
            open={openSections.includes('random_forest')}
            onOpenChange={() => toggleSection('random_forest')}
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 rounded-lg border hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <Trees className="h-4 w-4 text-green-600" />
                <span className="font-medium">Random Forest</span>
              </div>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  openSections.includes('random_forest') ? 'rotate-180' : ''
                }`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 px-4 pb-2 border-x border-b rounded-b-lg">
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm">Number of Trees</Label>
                  <Input
                    type="number"
                    className="mt-1"
                    value={config.random_forest.n_estimators}
                    onChange={(e) =>
                      updateHyperparameter('random_forest', 'n_estimators', parseInt(e.target.value) || 100)
                    }
                    min={10}
                    max={500}
                  />
                  <p className="text-xs text-muted-foreground mt-1">10-500 recommended</p>
                </div>
                <div>
                  <Label className="text-sm">Max Depth</Label>
                  <Input
                    type="number"
                    className="mt-1"
                    value={config.random_forest.max_depth}
                    onChange={(e) =>
                      updateHyperparameter('random_forest', 'max_depth', parseInt(e.target.value) || 10)
                    }
                    min={1}
                    max={50}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Limits tree depth</p>
                </div>
                <div>
                  <Label className="text-sm">Min Samples Split</Label>
                  <Input
                    type="number"
                    className="mt-1"
                    value={config.random_forest.min_samples_split}
                    onChange={(e) =>
                      updateHyperparameter('random_forest', 'min_samples_split', parseInt(e.target.value) || 2)
                    }
                    min={2}
                    max={20}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Min samples to split</p>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Gradient Boosting */}
        {selectedModels.gb && (
          <Collapsible
            open={openSections.includes('gradient_boosting')}
            onOpenChange={() => toggleSection('gradient_boosting')}
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 rounded-lg border hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <Rocket className="h-4 w-4 text-blue-600" />
                <span className="font-medium">Gradient Boosting</span>
              </div>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  openSections.includes('gradient_boosting') ? 'rotate-180' : ''
                }`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 px-4 pb-2 border-x border-b rounded-b-lg">
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm">Number of Estimators</Label>
                  <Input
                    type="number"
                    className="mt-1"
                    value={config.gradient_boosting.n_estimators}
                    onChange={(e) =>
                      updateHyperparameter('gradient_boosting', 'n_estimators', parseInt(e.target.value) || 100)
                    }
                    min={10}
                    max={500}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Boosting stages</p>
                </div>
                <div>
                  <Label className="text-sm">Learning Rate</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="mt-1"
                    value={config.gradient_boosting.learning_rate}
                    onChange={(e) =>
                      updateHyperparameter('gradient_boosting', 'learning_rate', parseFloat(e.target.value) || 0.1)
                    }
                    min={0.01}
                    max={1}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Step shrinkage</p>
                </div>
                <div>
                  <Label className="text-sm">Max Depth</Label>
                  <Input
                    type="number"
                    className="mt-1"
                    value={config.gradient_boosting.max_depth}
                    onChange={(e) =>
                      updateHyperparameter('gradient_boosting', 'max_depth', parseInt(e.target.value) || 3)
                    }
                    min={1}
                    max={20}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Tree complexity</p>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Logistic Regression */}
        {selectedModels.lr && (
          <Collapsible
            open={openSections.includes('logistic_regression')}
            onOpenChange={() => toggleSection('logistic_regression')}
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 rounded-lg border hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-purple-600" />
                <span className="font-medium">Logistic Regression</span>
              </div>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  openSections.includes('logistic_regression') ? 'rotate-180' : ''
                }`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 px-4 pb-2 border-x border-b rounded-b-lg">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">Regularization (C)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    className="mt-1"
                    value={config.logistic_regression.C}
                    onChange={(e) =>
                      updateHyperparameter('logistic_regression', 'C', parseFloat(e.target.value) || 1)
                    }
                    min={0.01}
                    max={100}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Inverse regularization strength</p>
                </div>
                <div>
                  <Label className="text-sm">Max Iterations</Label>
                  <Input
                    type="number"
                    className="mt-1"
                    value={config.logistic_regression.max_iter}
                    onChange={(e) =>
                      updateHyperparameter('logistic_regression', 'max_iter', parseInt(e.target.value) || 1000)
                    }
                    min={100}
                    max={10000}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Solver iterations</p>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {!selectedModels.rf && !selectedModels.gb && !selectedModels.lr && (
          <p className="text-muted-foreground text-center py-4">
            Select at least one model type to configure hyperparameters
          </p>
        )}
      </CardContent>
    </Card>
  );
}

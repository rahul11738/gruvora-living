import { useEffect } from 'react';
import { ChevronRight, Plus, Save, Trash2 } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { EVENT_VENUE_TYPES } from '../../lib/listingSchemas';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useListingForm } from './useListingForm';
import BasicStep from './steps/BasicStep';
import MediaStep from './steps/MediaStep';
import PricingStep from './steps/PricingStep';

function buildPayload(base, specific, category) {
  return {
    ...base,
    category,
    category_specific_fields: {
      ...specific,
      packages: (specific.packages || []).map((pkg) => ({
        ...pkg,
        price: parseFloat(pkg.price || 0),
        capacity: parseInt(pkg.capacity || 0, 10),
      })),
    },
    media: {
      ...base.media,
      images: (base.media?.images || []).map((image) => (typeof image === 'string' ? image : image.url)),
    },
    pricing: {
      ...base.pricing,
      type: 'per_day',
      amount: parseFloat(base.pricing.amount || 0),
    },
  };
}

export default function EventForm({ category, onSuccess }) {
  const { user } = useAuth();
  const {
    step,
    setStep,
    baseData,
    setBaseData,
    specificData,
    setSpecificData,
    submitting,
    saveDraft,
    loadDraft,
    submit,
  } = useListingForm({ category, role: user?.role, buildPayload, onSuccess });

  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  const packages = specificData.packages || [];

  return (
    <div className="space-y-6">
      {step === 0 && <BasicStep baseData={baseData} setBaseData={setBaseData} />}

      {step === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Venue type</Label>
              <Select value={specificData.venue_type || ''} onValueChange={(value) => setSpecificData((prev) => ({ ...prev, venue_type: value }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {EVENT_VENUE_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Indoor capacity</Label>
              <Input type="number" value={specificData.indoor_capacity || ''} onChange={(e) => setSpecificData((prev) => ({ ...prev, indoor_capacity: parseInt(e.target.value || '0', 10) }))} className="mt-1" />
            </div>
            <div>
              <Label>Outdoor capacity</Label>
              <Input type="number" value={specificData.outdoor_capacity || ''} onChange={(e) => setSpecificData((prev) => ({ ...prev, outdoor_capacity: parseInt(e.target.value || '0', 10) }))} className="mt-1" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Packages</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSpecificData((prev) => ({ ...prev, packages: [...(prev.packages || []), { name: '', price: '', capacity: '', inclusions: [] }] }))}
              >
                <Plus className="w-4 h-4 mr-1" /> Add package
              </Button>
            </div>
            <div className="space-y-2">
              {packages.map((pkg, index) => (
                <div key={`pkg-${index}`} className="p-3 rounded-lg border border-stone-200 space-y-2">
                  <div className="grid grid-cols-4 gap-2">
                    <Input placeholder="Name" value={pkg.name} onChange={(e) => {
                      const next = [...packages];
                      next[index] = { ...next[index], name: e.target.value };
                      setSpecificData((prev) => ({ ...prev, packages: next }));
                    }} />
                    <Input type="number" placeholder="Price" value={pkg.price} onChange={(e) => {
                      const next = [...packages];
                      next[index] = { ...next[index], price: e.target.value };
                      setSpecificData((prev) => ({ ...prev, packages: next }));
                    }} />
                    <Input type="number" placeholder="Capacity" value={pkg.capacity} onChange={(e) => {
                      const next = [...packages];
                      next[index] = { ...next[index], capacity: e.target.value };
                      setSpecificData((prev) => ({ ...prev, packages: next }));
                    }} />
                    <Button variant="ghost" size="icon" onClick={() => {
                      const next = packages.filter((_, i) => i !== index);
                      setSpecificData((prev) => ({ ...prev, packages: next }));
                    }}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                  <Input
                    placeholder="Inclusions (comma separated)"
                    value={(pkg.inclusions || []).join(', ')}
                    onChange={(e) => {
                      const next = [...packages];
                      next[index] = {
                        ...next[index],
                        inclusions: e.target.value.split(',').map((value) => value.trim()).filter(Boolean),
                      };
                      setSpecificData((prev) => ({ ...prev, packages: next }));
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 2 && <MediaStep baseData={baseData} setBaseData={setBaseData} label="Event venue images" />}
      {step === 3 && <PricingStep baseData={baseData} setBaseData={setBaseData} />}

      <div className="flex items-center justify-between pt-4 border-t border-stone-100">
        <div className="flex gap-2">
          {step > 0 && <Button variant="outline" onClick={() => setStep((s) => s - 1)}>Back</Button>}
          <Button variant="ghost" size="sm" onClick={saveDraft}><Save className="w-4 h-4 mr-1" /> Save draft</Button>
        </div>
        {step < 3 ? (
          <Button className="btn-primary" onClick={() => setStep((s) => s + 1)}>Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
        ) : (
          <Button className="btn-primary" onClick={submit} disabled={submitting}>{submitting ? 'Submitting...' : 'Publish listing'}</Button>
        )}
      </div>
    </div>
  );
}

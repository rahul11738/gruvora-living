import { useEffect } from 'react';
import { ChevronRight, Plus, Save, Trash2 } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { ROOM_TYPES, STAY_AMENITIES, STAY_TYPES } from '../../lib/listingSchemas';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useListingForm } from './useListingForm';
import BasicStep from './steps/BasicStep';
import MediaStep from './steps/MediaStep';
import PricingStep from './steps/PricingStep';

const STEPS = ['Basic info', 'Stay details', 'Media', 'Pricing'];

function buildPayload(base, specific, category) {
  return {
    ...base,
    category,
    category_specific_fields: specific,
    media: {
      ...base.media,
      images: (base.media?.images || []).map((image) => (typeof image === 'string' ? image : image.url)),
    },
    pricing: {
      ...base.pricing,
      type: 'per_night',
      amount: parseFloat(base.pricing.amount || 0),
    },
  };
}

export default function StayForm({ category, onSuccess }) {
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

  const roomConfigs = specificData.room_configs || [];

  return (
    <div className="space-y-6">
      {step === 0 && <BasicStep baseData={baseData} setBaseData={setBaseData} />}

      {step === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Stay type</Label>
              <Select
                value={specificData.stay_type || ''}
                onValueChange={(value) => setSpecificData((prev) => ({ ...prev, stay_type: value }))}
              >
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select stay type" /></SelectTrigger>
                <SelectContent>
                  {STAY_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Total rooms</Label>
              <Input
                type="number"
                value={specificData.total_rooms || ''}
                onChange={(e) => setSpecificData((prev) => ({ ...prev, total_rooms: parseInt(e.target.value || '0', 10) }))}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Room configurations</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setSpecificData((prev) => ({
                    ...prev,
                    room_configs: [
                      ...(prev.room_configs || []),
                      { room_type: 'ac', count: 1, price_per_night: 1000, max_occupancy: 2, amenities: [] },
                    ],
                  }))
                }
              >
                <Plus className="w-4 h-4 mr-1" /> Add room type
              </Button>
            </div>
            <div className="space-y-2">
              {roomConfigs.map((config, index) => (
                <div key={`${config.room_type}-${index}`} className="grid grid-cols-5 gap-2 items-end p-3 bg-stone-50 rounded-lg">
                  <Select
                    value={config.room_type}
                    onValueChange={(value) => {
                      const next = [...roomConfigs];
                      next[index] = { ...next[index], room_type: value };
                      setSpecificData((prev) => ({ ...prev, room_configs: next }));
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROOM_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    placeholder="Count"
                    value={config.count}
                    onChange={(e) => {
                      const next = [...roomConfigs];
                      next[index] = { ...next[index], count: parseInt(e.target.value || '0', 10) };
                      setSpecificData((prev) => ({ ...prev, room_configs: next }));
                    }}
                  />
                  <Input
                    type="number"
                    placeholder="Price"
                    value={config.price_per_night}
                    onChange={(e) => {
                      const next = [...roomConfigs];
                      next[index] = { ...next[index], price_per_night: parseFloat(e.target.value || '0') };
                      setSpecificData((prev) => ({ ...prev, room_configs: next }));
                    }}
                  />
                  <Input
                    type="number"
                    placeholder="Max occupancy"
                    value={config.max_occupancy}
                    onChange={(e) => {
                      const next = [...roomConfigs];
                      next[index] = { ...next[index], max_occupancy: parseInt(e.target.value || '0', 10) };
                      setSpecificData((prev) => ({ ...prev, room_configs: next }));
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const next = roomConfigs.filter((_, i) => i !== index);
                      setSpecificData((prev) => ({ ...prev, room_configs: next }));
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label>Amenities (comma separated)</Label>
            <Input
              value={(specificData.amenities || []).join(', ')}
              onChange={(e) =>
                setSpecificData((prev) => ({
                  ...prev,
                  amenities: e.target.value.split(',').map((value) => value.trim()).filter(Boolean),
                }))
              }
              placeholder={STAY_AMENITIES.join(', ')}
              className="mt-1"
            />
          </div>
        </div>
      )}

      {step === 2 && <MediaStep baseData={baseData} setBaseData={setBaseData} label="Stay images" />}
      {step === 3 && <PricingStep baseData={baseData} setBaseData={setBaseData} />}

      <div className="flex items-center justify-between pt-4 border-t border-stone-100">
        <div className="flex gap-2">
          {step > 0 && <Button variant="outline" onClick={() => setStep((s) => s - 1)}>Back</Button>}
          <Button variant="ghost" size="sm" onClick={saveDraft}><Save className="w-4 h-4 mr-1" /> Save draft</Button>
        </div>
        {step < STEPS.length - 1 ? (
          <Button className="btn-primary" onClick={() => setStep((s) => s + 1)}>Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
        ) : (
          <Button className="btn-primary" onClick={submit} disabled={submitting}>{submitting ? 'Submitting...' : 'Publish listing'}</Button>
        )}
      </div>
    </div>
  );
}

import { useEffect } from 'react';
import { Check, ChevronRight, Save } from 'lucide-react';

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useAuth } from '../../context/AuthContext';
import { PROPERTY_AMENITIES, PROPERTY_TYPES } from '../../lib/listingSchemas';
import { useListingForm } from './useListingForm';
import BasicStep from './steps/BasicStep';
import MediaStep from './steps/MediaStep';
import PricingStep from './steps/PricingStep';

const STEPS = ['Basic info', 'Property details', 'Amenities', 'Media', 'Pricing'];

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
      type: specific.listing_type || 'rent',
      amount: parseFloat(base.pricing.amount || 0),
      security_deposit: base.pricing.security_deposit ? parseFloat(base.pricing.security_deposit) : undefined,
    },
  };
}

const HOME_CATEGORIES = [
  { value: 'home', label: 'Home (Residential)' },
];

const PROPERTY_TYPES_HOME = ['flat', 'villa', 'rowhouse', 'bungalow', 'pg'];
const PROPERTY_TYPES_BUSINESS = ['shop', 'office', 'warehouse', 'plot'];

export default function PropertyForm({ category: initialCategory, onSuccess }) {
  const { user } = useAuth();
  const {
    step,
    setStep,
    baseData,
    setBaseData,
    specificData,
    setSpecificData,
    errors,
    submitting,
    saveDraft,
    loadDraft,
    submit,
  } = useListingForm({ category: initialCategory || 'home', role: user?.role, buildPayload, onSuccess });

  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  const updateSpecific = (key, value) => setSpecificData((prev) => ({ ...prev, [key]: value }));

  // Determine category - if user can choose (property owner without initial category), allow selection
  const canChooseCategory = user?.role === 'property_owner' && !initialCategory;
  const selectedCategory = canChooseCategory ? (baseData.category || 'home') : (initialCategory || 'home');
  const isResidential = PROPERTY_TYPES_HOME.includes(specificData.property_type);
  const availablePropertyTypes = selectedCategory === 'business' ? PROPERTY_TYPES_BUSINESS : PROPERTY_TYPES_HOME;

  const handleCategoryChange = (newCategory) => {
    setBaseData((prev) => ({ ...prev, category: newCategory }));
    // Reset property type when category changes
    if (specificData.property_type) {
      setSpecificData((prev) => {
        const { property_type, ...rest } = prev;
        return rest;
      });
    }
  };

  // Update baseData when initialCategory or user changes
  useEffect(() => {
    if (!canChooseCategory && initialCategory && baseData.category !== initialCategory) {
      setBaseData((prev) => ({ ...prev, category: initialCategory }));
    }
  }, [initialCategory, canChooseCategory, setBaseData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {STEPS.map((title, index) => (
          <div key={title} className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => index < step && setStep(index)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                index === step
                  ? 'bg-primary text-white'
                  : index < step
                    ? 'bg-green-100 text-green-700'
                    : 'bg-stone-100 text-stone-400'
              }`}
            >
              {index < step ? <Check className="w-3 h-3" /> : <span>{index + 1}</span>}
              <span className="hidden sm:inline">{title}</span>
            </button>
            {index < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-stone-300" />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <BasicStep baseData={baseData} setBaseData={setBaseData} />
          
          {/* Category selector for property owners */}
          {canChooseCategory && (
            <div>
              <Label>Listing Category</Label>
              <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="home">Home (Residential)</SelectItem>
                  <SelectItem value="business">Business (Commercial)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Property type</Label>
              <Select value={specificData.property_type || ''} onValueChange={(v) => updateSpecific('property_type', v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {PROPERTY_TYPES.filter((type) => availablePropertyTypes.includes(type.value)).map((type) => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.property_type && <p className="text-red-500 text-xs mt-1">{errors.property_type}</p>}
            </div>
            <div>
              <Label>Listing type</Label>
              <Select value={specificData.listing_type || ''} onValueChange={(v) => updateSpecific('listing_type', v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Rent / Sell" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rent">For Rent</SelectItem>
                  <SelectItem value="sell">For Sale</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isResidential && (
            <div>
              <Label>BHK</Label>
              <div className="flex gap-2 mt-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    onClick={() => updateSpecific('bhk', value)}
                    className={`w-12 h-12 rounded-lg border-2 text-sm font-semibold ${
                      specificData.bhk === value ? 'border-primary bg-primary text-white' : 'border-stone-200'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
              {errors.bhk && <p className="text-red-500 text-xs mt-1">{errors.bhk}</p>}
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Area (sq ft)</Label>
              <Input
                type="number"
                value={specificData.area_sqft || ''}
                onChange={(e) => updateSpecific('area_sqft', parseFloat(e.target.value || 0))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Floor</Label>
              <Input
                type="number"
                value={specificData.floor ?? ''}
                onChange={(e) => updateSpecific('floor', e.target.value ? parseInt(e.target.value, 10) : null)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Total floors</Label>
              <Input
                type="number"
                value={specificData.total_floors ?? ''}
                onChange={(e) => updateSpecific('total_floors', e.target.value ? parseInt(e.target.value, 10) : null)}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label>Furnishing</Label>
            <Select value={specificData.furnishing || ''} onValueChange={(v) => updateSpecific('furnishing', v)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="furnished">Fully furnished</SelectItem>
                <SelectItem value="semi_furnished">Semi furnished</SelectItem>
                <SelectItem value="unfurnished">Unfurnished</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <Label>Amenities</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PROPERTY_AMENITIES.map((amenity) => {
              const selected = (specificData.amenities || []).includes(amenity);
              return (
                <button
                  key={amenity}
                  onClick={() => {
                    const list = specificData.amenities || [];
                    updateSpecific(
                      'amenities',
                      selected ? list.filter((item) => item !== amenity) : [...list, amenity],
                    );
                  }}
                  className={`py-2 px-3 rounded-lg border text-sm text-left ${
                    selected ? 'border-primary bg-primary/10 text-primary' : 'border-stone-200 text-stone-600'
                  }`}
                >
                  {amenity.replace(/_/g, ' ')}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 3 && <MediaStep baseData={baseData} setBaseData={setBaseData} label="Property images (up to 15)" />}

      {step === 4 && (
        <PricingStep baseData={baseData} setBaseData={setBaseData}>
          <div className="rounded-xl border border-stone-200 p-4 bg-stone-50 text-sm space-y-1">
            <p><span className="font-medium">Title:</span> {baseData.title || '—'}</p>
            <p><span className="font-medium">Type:</span> {specificData.property_type || '—'}</p>
            <p><span className="font-medium">Area:</span> {specificData.area_sqft || '—'} sq ft</p>
            <p><span className="font-medium">Price:</span> INR {Number(baseData.pricing?.amount || 0).toLocaleString('en-IN')}</p>
          </div>
        </PricingStep>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-stone-100">
        <div className="flex gap-2">
          {step > 0 && <Button variant="outline" onClick={() => setStep((s) => s - 1)}>Back</Button>}
          <Button variant="ghost" size="sm" onClick={saveDraft}>
            <Save className="w-4 h-4 mr-1" /> Save draft
          </Button>
        </div>
        {step < STEPS.length - 1 ? (
          <Button className="btn-primary" onClick={() => setStep((s) => s + 1)}>
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button className="btn-primary" onClick={submit} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Publish listing'}
          </Button>
        )}
      </div>
    </div>
  );
}

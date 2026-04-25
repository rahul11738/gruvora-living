import os
import re

def main():
    file_path = "server.py"
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Fix the Paytm SDK import path and logger NameError
    paytm_init_old = r"# Initialize Paytm SDK if available.*?except ImportError:\s*PAYTMPG_SDK_AVAILABLE = False\s*logger\.warning\([^\)]+\)"
    
    paytm_init_new = """# Initialize Paytm SDK if available
try:
    import sys
    import os
    sdk_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "paytm pg python sdk master"))
    if sdk_path not in sys.path:
        sys.path.append(sdk_path)

    from paytmpg.merchant.models.Environment import Environment
    from paytmpg.pg.constants.MerchantProperty import MerchantProperty
    from paytmpg.pg.constants.LibraryConstants import LibraryConstants
    PAYTMPG_SDK_AVAILABLE = True
    
    # Initialize MerchantProperty
    _env = Environment.STAGE if PAYTM_WEBSITE == "WEBSTAGING" else Environment.PROD
    MerchantProperty.initialize(_env, PAYTM_MID, PAYTM_MERCHANT_KEY, "WEB", PAYTM_WEBSITE)
    MerchantProperty.set_callback_url(PAYTM_CALLBACK_URL)
except ImportError as e:
    PAYTMPG_SDK_AVAILABLE = False
    import logging
    logging.warning(f"paytmpg SDK not available: {e}, falling back to manual checksums.")"""
    
    content = re.sub(paytm_init_old, paytm_init_new, content, flags=re.DOTALL)

    # 2. Fix duplicated make_paytm_checksum function if it exists
    # The user pasted this in their diff:
    # def make_paytm_checksum(body):
    #     if isinstance(body, dict):
    #         # The separators=(',', ':') strictly prevents space generation
    #         return paytmchecksum.generateSignature(json.dumps(body, separators=(',', ':')), PAYTM_MERCHANT_KEY)
    #     return paytmchecksum.generateSignature(body, PAYTM_MERCHANT_KEY)
    # 
    # # And further down
    # def make_paytm_checksum(body: dict) -> str:
    #     return paytmchecksum.generateSignature(json.dumps(body, separators=(',', ':')), PAYTM_MERCHANT_KEY)
    
    dup_checksum_pattern = r"# And further down\n?def make_paytm_checksum\(body: dict\) -> str:\n\s*return paytmchecksum\.generateSignature\(json\.dumps\(body, separators=\(\',\', \':\'\)\), PAYTM_MERCHANT_KEY\)"
    content = re.sub(dup_checksum_pattern, "", content, flags=re.DOTALL)

    # 3. Clean up Razorpay references safely (commenting them out or removing imports)
    content = content.replace("import razorpay", "# import razorpay")
    content = content.replace("except razorpay.errors.SignatureVerificationError:", "except Exception as e: # razorpay removed")

    # Save changes
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

    print("Fixes applied to server.py successfully.")

if __name__ == "__main__":
    main()

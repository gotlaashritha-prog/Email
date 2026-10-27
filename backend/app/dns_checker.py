"""
DNS and mail-routing lookup module.
Handles MX record resolution, A/AAAA fallback lookups, timeouts, and temporary failures.
"""
import socket
from typing import Dict, Any, List, Optional
from backend.app.config import settings

class DNSResult:
    def __init__(
        self,
        domain: str,
        has_usable_route: bool,
        status: str, # "ok", "no_route", "timeout", "temporary_failure"
        mx_records: Optional[List[Dict[str, Any]]] = None,
        fallback_records: Optional[List[str]] = None,
        error_detail: Optional[str] = None
    ):
        self.domain = domain
        self.has_usable_route = has_usable_route
        self.status = status
        self.mx_records = mx_records or []
        self.fallback_records = fallback_records or []
        self.error_detail = error_detail

    def to_dict(self) -> Dict[str, Any]:
        return {
            "domain": self.domain,
            "has_usable_route": self.has_usable_route,
            "status": self.status,
            "mx_records": self.mx_records,
            "fallback_records": self.fallback_records,
            "error_detail": self.error_detail
        }

def lookup_mail_routing(domain: str, timeout: Optional[float] = None) -> DNSResult:
    """
    Performs DNS mail routing lookup:
    1. Try dnspython resolver if available, otherwise socket fallback.
    2. Check for MX records.
    3. If no MX, check fallback A/AAAA records (RFC 5321 implicit MX).
    4. Categorize as ok, no_route, timeout, or temporary_failure.
    """
    timeout = timeout or settings.DNS_TIMEOUT_SECONDS
    
    # Try using dnspython if installed
    try:
        import dns.resolver
        import dns.exception
        
        resolver = dns.resolver.Resolver()
        resolver.lifetime = timeout
        resolver.timeout = timeout
        
        # 1. Query MX records
        try:
            answers = resolver.resolve(domain, "MX")
            mx_list = []
            for rdata in answers:
                mx_list.append({
                    "exchange": str(rdata.exchange).rstrip("."),
                    "priority": int(rdata.preference)
                })
            mx_list.sort(key=lambda x: x["priority"])
            
            if mx_list:
                # Null MX check (RFC 7505: priority 0, exchange ".")
                if len(mx_list) == 1 and mx_list[0]["exchange"] == "" and mx_list[0]["priority"] == 0:
                    return DNSResult(
                        domain=domain,
                        has_usable_route=False,
                        status="no_route",
                        mx_records=mx_list,
                        error_detail="Domain has explicit Null MX (RFC 7505) indicating it does not accept email"
                    )
                return DNSResult(
                    domain=domain,
                    has_usable_route=True,
                    status="ok",
                    mx_records=mx_list
                )
        except (dns.resolver.NoAnswer, dns.resolver.NoNameservers):
            pass # Fall through to A/AAAA check
        except dns.resolver.NXDOMAIN:
            return DNSResult(
                domain=domain,
                has_usable_route=False,
                status="no_route",
                error_detail="Domain does not exist (NXDOMAIN)"
            )
        except dns.exception.Timeout:
            return DNSResult(
                domain=domain,
                has_usable_route=False,
                status="timeout",
                error_detail=f"DNS MX query timed out after {timeout}s"
            )
        except dns.resolver.LifetimeTimeout:
            return DNSResult(
                domain=domain,
                has_usable_route=False,
                status="timeout",
                error_detail=f"DNS query lifetime timed out after {timeout}s"
            )
        except Exception as e:
            err_str = str(e).lower()
            if "servfail" in err_str or "try again" in err_str:
                return DNSResult(
                    domain=domain,
                    has_usable_route=False,
                    status="temporary_failure",
                    error_detail=f"DNS temporary failure / SERVFAIL: {str(e)}"
                )
        
        # 2. Check fallback A/AAAA records (RFC 5321 §5.1 implicit MX)
        fallback_ips = []
        for qtype in ("A", "AAAA"):
            try:
                ip_answers = resolver.resolve(domain, qtype)
                for rdata in ip_answers:
                    fallback_ips.append(str(rdata))
            except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN):
                pass
            except dns.exception.Timeout:
                return DNSResult(
                    domain=domain,
                    has_usable_route=False,
                    status="timeout",
                    error_detail=f"DNS fallback {qtype} query timed out"
                )
            except Exception:
                pass
                
        if fallback_ips:
            return DNSResult(
                domain=domain,
                has_usable_route=True,
                status="ok",
                fallback_records=fallback_ips,
                error_detail="No MX record found; using RFC 5321 fallback A/AAAA address"
            )
        
        return DNSResult(
            domain=domain,
            has_usable_route=False,
            status="no_route",
            error_detail="Domain has neither MX records nor fallback A/AAAA records"
        )

    except ImportError:
        # Fallback using standard library socket (when dnspython is not installed)
        orig_timeout = socket.getdefaulttimeout()
        try:
            socket.setdefaulttimeout(timeout)
            # Try resolving host via socket
            try:
                addr_info = socket.getaddrinfo(domain, 25, socket.AF_UNSPEC, socket.SOCK_STREAM)
                ips = list({info[4][0] for info in addr_info})
                if ips:
                    return DNSResult(
                        domain=domain,
                        has_usable_route=True,
                        status="ok",
                        fallback_records=ips,
                        error_detail="Resolved via host address lookup (RFC 5321 fallback routing)"
                    )
            except socket.gaierror as e:
                err_code = e.errno
                err_msg = str(e).lower()
                if "name or service not known" in err_msg or "nodename nor servname provided" in err_msg or err_code == socket.EAI_NONAME:
                    return DNSResult(
                        domain=domain,
                        has_usable_route=False,
                        status="no_route",
                        error_detail="Domain has no usable host address or mail routing destination"
                    )
                elif "temporary failure" in err_msg or err_code == getattr(socket, "EAI_AGAIN", -3):
                    return DNSResult(
                        domain=domain,
                        has_usable_route=False,
                        status="temporary_failure",
                        error_detail=f"Temporary DNS lookup failure: {str(e)}"
                    )
                else:
                    return DNSResult(
                        domain=domain,
                        has_usable_route=False,
                        status="no_route",
                        error_detail=f"DNS resolution failure: {str(e)}"
                    )
            except socket.timeout:
                return DNSResult(
                    domain=domain,
                    has_usable_route=False,
                    status="timeout",
                    error_detail=f"DNS lookup timed out after {timeout}s"
                )
            
            return DNSResult(
                domain=domain,
                has_usable_route=False,
                status="no_route",
                error_detail="No usable mail route found"
            )
        finally:
            socket.setdefaulttimeout(orig_timeout)

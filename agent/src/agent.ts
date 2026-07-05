// bloi Agent - Autonomous yield optimization agent

import { BlockchainService, ContractAddresses } from './blockchain.js';
import { LLMService } from './llm.js';
import { AgentWebSocket } from './websocket.js';
import { analyzeInvoice, applyMarketAdjustment, updateMarketRegime, applyRegimeAdjustment, getCurrentRegime, getRegimeStats } from './optimizer.js';
import { AgentConfig, AgentThought, Strategy, AnalysisResult, MarketConditions, MarketAlert } from './types.js';
import { STRATEGY_NAMES } from './constants.js';
import { createNanopayments, AgentNanopayments } from './nanopayments.js';
import { createArcAgentKit, ArcAgentKit } from './arc-appkit.js';

export class BloiAgent {
  private blockchain: BlockchainService;
  private llm: LLMService;
  private ws: AgentWebSocket;
  private config: AgentConfig;
  private isRunning = false;
  private analysisLoop: NodeJS.Timeout | null = null;

  private nanopay: AgentNanopayments | null = null;
  private arcKit: ArcAgentKit | null = null;

  // Rate limiting: track last analysis time per invoice
  private lastAnalysisTime: Map<string, number> = new Map();
  private readonly ANALYSIS_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

  // Yield distribution: rate-limit and track distributed amounts per invoice
  private yieldDistributionTime: Map<string, number> = new Map();
  private lastDistributedYield: Map<string, bigint> = new Map();
  private readonly YIELD_DISTRIBUTION_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
  private readonly YIELD_DISTRIBUTION_THRESHOLD_USDC = 0.01; // $0.01 minimum

  // Circuit breaker for analysis cycles
  private consecutiveFailures = 0;
  private readonly MAX_CONSECUTIVE_FAILURES = 3;
  private circuitBreakerOpen = false;
  private circuitBreakerResetTime = 0;
  private readonly CIRCUIT_BREAKER_TIMEOUT_MS = 60 * 1000; // 1 minute

  constructor(
    rpcUrl: string,
    addresses: ContractAddresses,
    options: {
      privateKey?: string;
      openaiApiKey?: string;
      wsPort?: number;
      config?: Partial<AgentConfig>;
    } = {}
  ) {
    this.blockchain = new BlockchainService(rpcUrl, addresses, options.privateKey);
    this.llm = new LLMService(options.openaiApiKey);
    this.ws = new AgentWebSocket(options.wsPort || 8080);

    this.config = {
      minConfidence: 70,
      analysisInterval: 30000, // 30 seconds
      maxConcurrentAnalyses: 5,
      autoExecute: true,
      ...options.config,
    };

    // Handle manual analysis requests from frontend
    this.ws.onAnalysisRequest = (tokenId) => {
      this.analyzeInvoice(tokenId);
    };

    // Initialize Circle Gateway nanopayments buyer (Base Sepolia)
    this.nanopay = createNanopayments();
    if (this.nanopay) {
      console.log('[nanopay] AgentNanopayments initialized — will auto-fund and pay for x402 resources');
    }

    // Initialize Arc App Kit for USDC send operations on Base Sepolia
    this.arcKit = createArcAgentKit();
    if (this.arcKit) {
      console.log('[arc] ArcAgentKit initialized — arc.send() available for USDC transfers on Base Sepolia');
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    console.log('🤖 bloi Agent starting...');

    // Start WebSocket server
    this.ws.start();

    // Verify agent authorization
    const agentAddress = this.blockchain.getAgentAddress();
    if (agentAddress) {
      const authorized = await this.blockchain.isAgentAuthorized(agentAddress);
      if (!authorized) {
        console.warn(`⚠️  Agent ${agentAddress} is not authorized on AgentRouter`);
      } else {
        console.log(`✅ Agent ${agentAddress} is authorized`);
      }
    } else {
      console.warn('⚠️  No private key provided - agent will run in read-only mode');
    }

    // Ensure the agent's Gateway balance is funded before starting analysis
    if (this.nanopay) {
      try {
        await this.nanopay.ensureFunded();
        const balances = await this.nanopay.getBalances();
        console.log(
          `[nanopay] Gateway: ${balances.gateway.formattedAvailable} USDC | Wallet: ${balances.wallet.formatted} USDC`
        );
        this.broadcastThought({
          type: 'thinking',
          tokenId: 'system',
          message: `💳 Gateway funded: ${balances.gateway.formattedAvailable} USDC available for nanopayments`,
          timestamp: Date.now(),
        });
      } catch (err) {
        console.warn('[nanopay] ensureFunded failed (non-fatal):', err);
      }
    }

    this.isRunning = true;

    // Set up contract event listeners
    this.setupEventListeners();

    // Broadcast startup
    this.broadcastThought({
      type: 'thinking',
      tokenId: 'system',
      message: '🏭 bloi Agent is now active and monitoring invoices...',
      timestamp: Date.now(),
    });

    // Start analysis loop
    this.startAnalysisLoop();

    console.log('🤖 bloi Agent started successfully');
  }

  stop(): void {
    if (!this.isRunning) return;

    if (this.analysisLoop) {
      clearInterval(this.analysisLoop);
      this.analysisLoop = null;
    }

    this.ws.stop();
    this.isRunning = false;

    console.log('🤖 bloi Agent stopped');
  }

  private setupEventListeners(): void {
    // Listen for on-chain decision events
    this.blockchain.onDecisionRecorded((tokenId, strategy, confidence) => {
      console.log(`📡 Event: DecisionRecorded for #${tokenId}`);
      this.broadcastThought({
        type: 'execution',
        tokenId,
        message: `📡 On-chain: Decision recorded - ${STRATEGY_NAMES[strategy]} (${confidence}% confidence)`,
        timestamp: Date.now(),
        data: { strategy: STRATEGY_NAMES[strategy], confidence },
      });
    });

    this.blockchain.onDecisionExecuted((tokenId, strategy) => {
      console.log(`📡 Event: DecisionExecuted for #${tokenId}`);
      this.broadcastThought({
        type: 'execution',
        tokenId,
        message: `📡 On-chain: Strategy changed to ${STRATEGY_NAMES[strategy]}`,
        timestamp: Date.now(),
        data: { strategy: STRATEGY_NAMES[strategy] },
      });
    });

    console.log('✅ Contract event listeners initialized');
  }

  private isRateLimited(tokenId: string): boolean {
    const lastTime = this.lastAnalysisTime.get(tokenId);
    if (!lastTime) return false;
    return Date.now() - lastTime < this.ANALYSIS_COOLDOWN_MS;
  }

  private recordAnalysisTime(tokenId: string): void {
    this.lastAnalysisTime.set(tokenId, Date.now());
  }

  private checkCircuitBreaker(): boolean {
    if (!this.circuitBreakerOpen) return false;

    // Check if we should reset the circuit breaker
    if (Date.now() > this.circuitBreakerResetTime) {
      this.circuitBreakerOpen = false;
      this.consecutiveFailures = 0;
      console.log('🔄 Circuit breaker reset');
      return false;
    }

    return true;
  }

  private tripCircuitBreaker(): void {
    this.circuitBreakerOpen = true;
    this.circuitBreakerResetTime = Date.now() + this.CIRCUIT_BREAKER_TIMEOUT_MS;
    console.warn(`⚠️ Circuit breaker tripped after ${this.consecutiveFailures} failures. Pausing for ${this.CIRCUIT_BREAKER_TIMEOUT_MS / 1000}s`);
  }

  private startAnalysisLoop(): void {
    // Run initial analysis
    this.runAnalysisCycle();

    // Set up recurring analysis
    this.analysisLoop = setInterval(() => {
      this.runAnalysisCycle();
    }, this.config.analysisInterval);
  }

  private currentMarketConditions: MarketConditions | null = null;
  private currentMarketAlert: MarketAlert | null = null;

  private async runAnalysisCycle(): Promise<void> {
    // Timeout protection - wrap entire cycle with 60s timeout
    const CYCLE_TIMEOUT_MS = 60000; // 60 seconds

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Analysis cycle timeout')), CYCLE_TIMEOUT_MS);
    });

    try {
      await Promise.race([
        this.runAnalysisCycleInternal(),
        timeoutPromise
      ]);
    } catch (error) {
      if (error instanceof Error && error.message === 'Analysis cycle timeout') {
        console.error('⚠️ Analysis cycle exceeded 60s timeout, skipping...');
        this.broadcastThought({
          type: 'error',
          tokenId: 'system',
          message: '⏱️ Analysis cycle timed out - will retry next interval',
          timestamp: Date.now(),
        });
        this.tripCircuitBreaker(); // Trip circuit breaker on timeout
      } else {
        throw error; // Re-throw other errors
      }
    }
  }

  private async runAnalysisCycleInternal(): Promise<void> {
    // Check circuit breaker
    if (this.checkCircuitBreaker()) {
      console.log('⏸️ Circuit breaker is open, skipping cycle');
      return;
    }

    try {
      // Step 1: Check market conditions via oracle
      this.broadcastThought({
        type: 'thinking',
        tokenId: 'system',
        message: '📡 Checking market conditions via Pyth Oracle...',
        timestamp: Date.now(),
      });

      this.currentMarketConditions = await this.blockchain.getMarketConditions();
      this.currentMarketAlert = this.blockchain.checkMarketAlert(this.currentMarketConditions);

      // Update market regime detection
      const regime = updateMarketRegime(this.currentMarketConditions);

      // Broadcast market status with drama
      if (this.currentMarketAlert) {
        const alertEmoji = this.currentMarketAlert.level === 'critical' ? '🚨' :
                          this.currentMarketAlert.level === 'warning' ? '⚠️' : 'ℹ️';

        this.broadcastThought({
          type: this.currentMarketAlert.level === 'critical' ? 'error' : 'analysis',
          tokenId: 'market',
          message: `${alertEmoji} ${this.currentMarketAlert.message}`,
          timestamp: Date.now(),
          data: {
            priceChange: this.currentMarketConditions.ethPriceChange24h,
            volatility: this.currentMarketConditions.volatilityLevel,
            ethPrice: this.currentMarketConditions.ethPrice,
          },
        });

        await this.delay(800);

        this.broadcastThought({
          type: 'decision',
          tokenId: 'market',
          message: `🤖 ${this.currentMarketAlert.recommendation}`,
          timestamp: Date.now(),
        });

        await this.delay(500);
      } else {
        const priceInfo = this.currentMarketConditions.ethPrice
          ? `ETH: $${this.currentMarketConditions.ethPrice.toFixed(2)}`
          : 'Prices: Simulated mode';

        const regimeEmoji = regime === 'bull' ? '📈' : regime === 'bear' ? '📉' : regime === 'volatile' ? '🌊' : '⚖️';
        const regimeLabel = regime.charAt(0).toUpperCase() + regime.slice(1);

        this.broadcastThought({
          type: 'thinking',
          tokenId: 'system',
          message: `✅ Market ${regimeLabel} ${regimeEmoji} (${priceInfo}) - volatility: ${this.currentMarketConditions.volatilityLevel}`,
          timestamp: Date.now(),
          data: {
            regime,
            volatility: this.currentMarketConditions.volatilityLevel,
          },
        });
      }

      await this.delay(300);

      // Step 2: Scan for invoices
      this.broadcastThought({
        type: 'thinking',
        tokenId: 'system',
        message: '🔍 Scanning blockchain for invoices...',
        timestamp: Date.now(),
      });

      // Optional: fetch enriched invoice data from vasmo app via Circle Gateway nanopayment
      // Runs in parallel with blockchain scan; failure is non-fatal
      const paidFetchPromise = this.fetchPaidInvoiceData();

      // Get ALL active invoices (not just those in yield strategies)
      const [invoicesResult, depositsResult] = await Promise.all([
        this.blockchain.getActiveInvoices(),
        this.blockchain.getActiveDeposits(),
      ]);

      // Check for contract errors (distinguish from empty results)
      if (invoicesResult.error || depositsResult.error) {
        const errors = [invoicesResult.error, depositsResult.error].filter(Boolean).join(', ');
        this.broadcastThought({
          type: 'error',
          tokenId: 'system',
          message: `⚠️ Contract call failed: ${errors}. Will retry next cycle.`,
          timestamp: Date.now(),
        });
        return;
      }

      const activeInvoices = invoicesResult.ids;
      const activeDeposits = depositsResult.ids;

      // Await the paid fetch (if it was initiated) — result used for logging/enrichment
      const paidInvoices = await paidFetchPromise;
      if (paidInvoices !== null) {
        console.log(`[nanopay] Paid fetch returned ${paidInvoices.length} invoice records`);
      }

      // Combine and deduplicate - prioritize all invoices
      const allTokenIds = [...new Set([...activeInvoices, ...activeDeposits])];

      if (allTokenIds.length === 0) {
        this.broadcastThought({
          type: 'thinking',
          tokenId: 'system',
          message: '📭 No invoices found. Waiting for new invoices to be minted...',
          timestamp: Date.now(),
        });
        return;
      }

      const depositCount = activeDeposits.length;
      const pendingCount = allTokenIds.length - depositCount;

      this.broadcastThought({
        type: 'thinking',
        tokenId: 'system',
        message: `📊 Found ${allTokenIds.length} invoice(s): ${depositCount} earning yield, ${pendingCount} pending. Analyzing...`,
        timestamp: Date.now(),
      });

      // Analyze each invoice (with market context)
      const analysisPromises = allTokenIds
        .slice(0, this.config.maxConcurrentAnalyses)
        .map((tokenId) => this.analyzeInvoice(tokenId));

      await Promise.allSettled(analysisPromises);

      // Get transaction cost
      const txCost = await this.blockchain.getEstimatedTxCost();

      this.broadcastThought({
        type: 'thinking',
        tokenId: 'system',
        message: `✅ Cycle complete. Next scan in ${this.config.analysisInterval / 1000}s | Tx cost: ${txCost.costUsd}`,
        timestamp: Date.now(),
        data: { txCostUsd: txCost.costUsd },
      });
      // Reset failure count on success
      this.consecutiveFailures = 0;
    } catch (error) {
      console.error('Error in analysis cycle:', error);
      this.ws.broadcastError('system', `Analysis cycle error: ${error}`);

      // Track consecutive failures for circuit breaker
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
        this.tripCircuitBreaker();
        this.broadcastThought({
          type: 'error',
          tokenId: 'system',
          message: `⚠️ Too many failures (${this.consecutiveFailures}). Pausing analysis for 1 minute...`,
          timestamp: Date.now(),
        });
      }
    }
  }

  async analyzeInvoice(tokenId: string): Promise<AnalysisResult | null> {
    // Check rate limiting
    if (this.isRateLimited(tokenId)) {
      console.log(`⏳ Invoice #${tokenId} is rate-limited, skipping`);
      return null;
    }
    try {
      // Fetch invoice and deposit data
      const [invoice, deposit] = await Promise.all([
        this.blockchain.getInvoice(tokenId),
        this.blockchain.getDeposit(tokenId),
      ]);

      if (!invoice) {
        this.ws.broadcastError(tokenId, `Invoice #${tokenId} not found`);
        return null;
      }

      const isDeposited = deposit !== null;

      // Broadcast thinking start
      this.broadcastThought({
        type: 'thinking',
        tokenId,
        message: `🔍 Analyzing Invoice #${tokenId}${isDeposited ? ' (earning yield)' : ' (awaiting deposit)'}...`,
        timestamp: Date.now(),
        data: { step: 1, total: 4, isDeposited },
      });

      // Analyze using optimizer
      const currentTimestamp = Math.floor(Date.now() / 1000);
      let analysis = analyzeInvoice(invoice, deposit || undefined, currentTimestamp);

      // Apply market adjustments based on oracle data
      const originalStrategy = analysis.recommendedStrategy;
      analysis = applyMarketAdjustment(analysis, this.currentMarketConditions, this.currentMarketAlert);

      // Apply regime-based adjustments
      const preRegimeStrategy = analysis.recommendedStrategy;
      analysis = applyRegimeAdjustment(analysis);
      const wasRegimeAdjusted = preRegimeStrategy !== analysis.recommendedStrategy;

      const wasAdjusted = originalStrategy !== analysis.recommendedStrategy;

      // Broadcast risk assessment
      await this.delay(400);
      this.broadcastThought({
        type: 'analysis',
        tokenId,
        message: `📈 Risk Score: ${analysis.riskScore}/100 | Payment Prob: ${analysis.paymentProbability}% | Days to due: ${analysis.daysUntilDue}`,
        timestamp: Date.now(),
        data: {
          riskScore: analysis.riskScore,
          paymentProbability: analysis.paymentProbability,
          daysUntilDue: analysis.daysUntilDue,
        },
      });

      // Broadcast strategy evaluation with market context
      await this.delay(400);

      if (wasAdjusted && this.currentMarketAlert) {
        // DRAMATIC: Show the market override happening
        this.broadcastThought({
          type: 'analysis',
          tokenId,
          message: `⚡ MARKET OVERRIDE: ${STRATEGY_NAMES[analysis.currentStrategy]} → ${STRATEGY_NAMES[analysis.recommendedStrategy]} (was ${STRATEGY_NAMES[originalStrategy]})`,
          timestamp: Date.now(),
          data: {
            currentStrategy: STRATEGY_NAMES[analysis.currentStrategy],
            recommendedStrategy: STRATEGY_NAMES[analysis.recommendedStrategy],
            originalRecommendation: STRATEGY_NAMES[originalStrategy],
            confidence: analysis.confidence,
            shouldAct: analysis.shouldAct,
            marketOverride: true,
          },
        });
      } else {
        this.broadcastThought({
          type: 'analysis',
          tokenId,
          message: `🎯 Strategy: ${STRATEGY_NAMES[analysis.currentStrategy]} → ${STRATEGY_NAMES[analysis.recommendedStrategy]} (${analysis.confidence}% confidence)`,
          timestamp: Date.now(),
          data: {
            currentStrategy: STRATEGY_NAMES[analysis.currentStrategy],
            recommendedStrategy: STRATEGY_NAMES[analysis.recommendedStrategy],
            confidence: analysis.confidence,
            shouldAct: analysis.shouldAct,
          },
        });
      }

      // Generate LLM explanation
      await this.delay(400);
      const explanation = await this.llm.generateExplanation(analysis);

      // Broadcast decision
      this.broadcastThought({
        type: 'decision',
        tokenId,
        message: explanation,
        timestamp: Date.now(),
        data: {
          shouldAct: analysis.shouldAct,
          strategy: analysis.recommendedStrategy,
        },
      });

      // Execute if conditions met
      if (analysis.shouldAct && this.config.autoExecute) {
        if (isDeposited) {
          await this.executeDecision(tokenId, analysis);
        } else {
          // Invoice not in YieldVault - provide guidance
          this.broadcastThought({
            type: 'thinking',
            tokenId,
            message: `💡 Invoice #${tokenId} not yet deposited. Deposit it to start earning with ${STRATEGY_NAMES[analysis.recommendedStrategy]} strategy.`,
            timestamp: Date.now(),
            data: { recommendedStrategy: STRATEGY_NAMES[analysis.recommendedStrategy], awaitingDeposit: true },
          });
        }
      }

      // Distribute accrued yield to issuer via Arc App Kit if threshold is met.
      // Runs every analysis cycle for deposited invoices — independent of strategy changes.
      if (isDeposited && invoice?.issuer && deposit?.active) {
        await this.maybeDistributeYield(tokenId, invoice.issuer, deposit);
      }

      // Record analysis time for rate limiting
      this.recordAnalysisTime(tokenId);

      return analysis;
    } catch (error) {
      console.error(`Error analyzing invoice ${tokenId}:`, error);
      this.ws.broadcastError(tokenId, `Analysis failed: ${error}`);
      return null;
    }
  }

  private async executeDecision(tokenId: string, analysis: AnalysisResult): Promise<void> {
    this.broadcastThought({
      type: 'execution',
      tokenId,
      message: `⚡ Executing: Change to ${STRATEGY_NAMES[analysis.recommendedStrategy]} strategy...`,
      timestamp: Date.now(),
    });

    const result = await this.blockchain.recordDecision(
      tokenId,
      analysis.recommendedStrategy,
      analysis.confidence,
      analysis.reasoning
    );

    if (result.success) {
      this.ws.broadcastExecution(tokenId, true, result.txHash);
      this.broadcastThought({
        type: 'execution',
        tokenId,
        message: `✅ Strategy updated to ${STRATEGY_NAMES[analysis.recommendedStrategy]}`,
        timestamp: Date.now(),
        data: { txHash: result.txHash },
      });
    } else {
      this.ws.broadcastExecution(tokenId, false);
      this.broadcastThought({
        type: 'error',
        tokenId,
        message: '❌ Strategy update failed - will retry next cycle',
        timestamp: Date.now(),
      });
    }
  }

  private broadcastThought(thought: AgentThought): void {
    this.ws.broadcastThought(thought);

    // Also log to console with emoji
    const prefix = {
      thinking: '💭',
      analysis: '📊',
      decision: '🎯',
      execution: '⚡',
      error: '❌',
    }[thought.type];

    console.log(`${prefix} [${thought.tokenId}] ${thought.message}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Checks whether the invoice has enough accrued yield to distribute,
   * respects a per-invoice cooldown, and calls sendYieldToIssuer() if so.
   *
   * Called every analysis cycle for deposited invoices — distribution is
   * independent of strategy changes so yield flows continuously as it accrues.
   */
  private async maybeDistributeYield(
    tokenId: string,
    issuerAddress: string,
    deposit: import('./types.js').Deposit
  ): Promise<void> {
    if (!this.arcKit) return;

    // Per-invoice cooldown: don't distribute more often than every 5 minutes
    const lastDist = this.yieldDistributionTime.get(tokenId) ?? 0;
    if (Date.now() - lastDist < this.YIELD_DISTRIBUTION_COOLDOWN_MS) return;

    // Only send the delta: yield accrued since the last distribution.
    // accruedYield is cumulative in the contract and never reset by the agent,
    // so without this delta tracking every cycle would re-send the full total.
    const alreadyDistributed = this.lastDistributedYield.get(tokenId) ?? 0n;
    const pendingYield = deposit.accruedYield - alreadyDistributed;
    if (pendingYield <= 0n) return;

    // Safe float conversion — pendingYield is the delta, which is much smaller
    // than the cumulative total and well within JS safe-integer range for USDC amounts.
    const yieldFloat = Number(pendingYield) / 1e18;
    if (yieldFloat < this.YIELD_DISTRIBUTION_THRESHOLD_USDC) return;

    const yieldFormatted = yieldFloat.toFixed(6);

    this.broadcastThought({
      type: 'thinking',
      tokenId,
      message: `💰 Invoice #${tokenId}: $${yieldFormatted} USDC new yield → distributing to issuer via Arc`,
      timestamp: Date.now(),
      data: { yieldAmount: yieldFormatted, issuer: issuerAddress },
    });

    await this.sendYieldToIssuer(issuerAddress, yieldFormatted);
    this.lastDistributedYield.set(tokenId, deposit.accruedYield);
    this.yieldDistributionTime.set(tokenId, Date.now());
  }

  /**
   * Sends USDC yield to an invoice issuer using Arc App Kit (kit.send()).
   * Called after a yield strategy succeeds and the agent needs to distribute
   * earnings from the vault to the original issuer address.
   *
   * Arc App Kit handles fee estimation, transaction submission, and receipt
   * on Base Sepolia without the agent managing raw contract calls.
   */
  async sendYieldToIssuer(issuerAddress: string, amount: string): Promise<void> {
    if (!this.arcKit) {
      console.log('[arc] ArcAgentKit not configured — skipping yield distribution');
      return;
    }

    this.broadcastThought({
      type: 'execution',
      tokenId: 'system',
      message: `💸 Arc: Sending ${amount} USDC yield to issuer ${issuerAddress.slice(0, 8)}...`,
      timestamp: Date.now(),
    });

    try {
      const estimate = await this.arcKit.estimateSend(issuerAddress, amount);
      console.log(`[arc] Send estimate:`, estimate);

      const result = await this.arcKit.sendUsdc(issuerAddress, amount);

      this.broadcastThought({
        type: 'execution',
        tokenId: 'system',
        message: `✅ Arc: Yield sent — ${result.txHash ? result.txHash.slice(0, 16) + '...' : result.state}`,
        timestamp: Date.now(),
        data: { txHash: result.txHash, explorerUrl: result.explorerUrl },
      });

      if (result.explorerUrl) {
        console.log(`[arc] Explorer: ${result.explorerUrl}`);
      }
    } catch (err) {
      console.error('[arc] sendYieldToIssuer failed:', err);
      this.broadcastThought({
        type: 'error',
        tokenId: 'system',
        message: `❌ Arc: Yield distribution failed — ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Fetches the active invoice dataset from the vasmo app's x402-gated endpoint,
   * paying $0.001 USDC via Circle Gateway nanopayments.
   *
   * Falls back gracefully if nanopayments are not configured or the endpoint
   * is unreachable — the agent continues using direct blockchain reads.
   */
  async fetchPaidInvoiceData(): Promise<unknown[] | null> {
    if (!this.nanopay) return null;

    const appUrl = process.env.BLOI_APP_URL || process.env.VASMO_APP_URL || 'http://localhost:3000';
    const endpoint = `${appUrl}/api/payments`;

    try {
      const supported = await this.nanopay.supports(endpoint);
      if (!supported) {
        console.log('[nanopay] /api/payments does not advertise x402 support — skipping paid fetch');
        return null;
      }

      const { data, amountPaid } = await this.nanopay.pay<{
        data: { invoices: unknown[]; total: number };
      }>(endpoint);

      this.broadcastThought({
        type: 'thinking',
        tokenId: 'system',
        message: `💳 Paid ${amountPaid} USDC → fetched ${(data as { data: { invoices: unknown[] } }).data.invoices.length} invoices via Circle Gateway`,
        timestamp: Date.now(),
      });

      return (data as { data: { invoices: unknown[] } }).data.invoices;
    } catch (err) {
      console.warn('[nanopay] fetchPaidInvoiceData failed (non-fatal):', err);
      return null;
    }
  }

  // Public API for manual triggers
  async triggerAnalysis(tokenId: string): Promise<AnalysisResult | null> {
    return this.analyzeInvoice(tokenId);
  }

  getStatus(): {
    running: boolean;
    connectedClients: number;
    config: AgentConfig;
  } {
    return {
      running: this.isRunning,
      connectedClients: this.ws.getConnectedClients(),
      config: this.config,
    };
  }

  // NOTE: Direct blockchain service access removed for security
  // WebSocket commands should go through specific, validated methods on the agent
  // If you need to add a new command, add a specific method here with proper validation
}

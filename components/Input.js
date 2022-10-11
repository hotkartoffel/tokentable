import { classNames, formatAmount, formatCurrency } from "@/lib/utils";
import { ArrowsRightLeftIcon } from "@heroicons/react/24/outline";
import { forwardRef, useCallback, useEffect, useState } from "react";

export const Input = forwardRef(function Input({ className, type = "text", ...args }, ref) {
  return (
    <input
      type={type}
      className={classNames("block w-full rounded-md border-gray-300 shadow-sm sm:text-sm", className)}
      ref={ref}
      {...args}
    />
  )
})

export const CurrencyInput = forwardRef(function CurrencyInput ({ symbol, children, className, ...args }, ref) {
  return (
    <div className="relative mt-1 rounded-md shadow-sm">
      <Input
        type="number"
        className={classNames("pr-12", className)}
        ref={ref}
        {...args}
      />
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
        <span className="text-gray-500 sm:text-sm">
          {symbol}
        </span>
      </div>
    </div>
  )
})

export const Label = ({ className, children }) => (
  <label className={classNames("block text-sm pb-1", className)}>
    {children}
  </label>
)

export const TokenAmountInput = forwardRef(function TokenAmountInput({ tokenSymbol, tokenPrice, ...args }, ref) {
  const [inputValue, setInputValue] = useState(0)
  const [fiatAmount, setFiatAmount] = useState(0)
  const [tokenAmount, setTokenAmount] = useState(0)
  const [isFiatInput, setIsFiatInput] = useState(false)

  const { onChange, name } = args
  const handleTokenAmountChange = useCallback(
    (value) =>
      onChange({
        target: {
          value,
          name,
        },
        type: 'change',
      }),
    [name, onChange]
  )

  useEffect(() => {
    handleTokenAmountChange(tokenAmount)
  }, [tokenAmount, handleTokenAmountChange])

  useEffect(() => {
    if (!tokenPrice) setIsFiatInput(false)

    // Reset if token changes
    setInputValue(0)
    setTokenAmount(0)
    setFiatAmount(0)
  }, [tokenPrice, tokenSymbol])

  const handleConversionSwitch = () => {
    if (!tokenPrice) return
    const inputAmount = isFiatInput ? tokenAmount : fiatAmount
    setInputValue(formatAmount(inputAmount, { commify: false }))
    setIsFiatInput(isFiatAmount => !isFiatAmount)
  }

  const handleInputChange = (event) => {
    const inputValue = event.target.value
    setInputValue(inputValue)

    if (isFiatInput) {
      setTokenAmount(formatAmount(inputValue / tokenPrice, {commify: false}))
      setFiatAmount(formatAmount(inputValue, {commify: false}))
    } else {
      setTokenAmount(formatAmount(inputValue, {commify: false}))
      setFiatAmount(formatAmount(inputValue * tokenPrice, {commify: false}))
    }
  }

  const inputSymbol = isFiatInput ? "USD" : tokenSymbol
  const otherSymbol = isFiatInput ? tokenSymbol : "USD"
  const otherValue = isFiatInput ? tokenAmount : fiatAmount

  return (
    <>
      <input type="hidden" ref={ref} {...args} />
      <CurrencyInput
        symbol={inputSymbol}
        onChange={handleInputChange}
        value={inputValue}
        placeholder="0.00"
      />
      {tokenPrice && (
        <span className="text-xs text-gray-500 flex gap-1 py-2">
          <ArrowsRightLeftIcon onClick={handleConversionSwitch} className="h-4 w-4 hover:cursor-pointer" />
          {formatCurrency(otherValue, otherSymbol)}
        </span>
      )}
    </>
  )
})
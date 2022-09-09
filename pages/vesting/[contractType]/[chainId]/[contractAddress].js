import VestingInsights from "@/components/VestingInsights"
import VestingTable from "@/components/VestingTable"
import { useRouter } from "next/router"
import { Fragment, useEffect, useState } from "react"
import { BigNumber } from "ethers"
import { LayoutWrapper } from "@/components/LayoutWrapper"
import { getVestingData } from "@/lib/vesting"
import { PrimaryButton } from "@/components/Button"
import { Modal, ModalActionFooter, ModalBody, ModalTitle } from "@/components/Modal"
import { useForm } from "react-hook-form"

import { isAddress, parseUnits } from "ethers/lib/utils"
import { CurrencyInput, Input, Label } from "@/components/Input"
import Spinner from "@/components/Spinner"
import { useTokenDetails, useTokenFormatter } from "@/lib/tokens"
import { useAccount, useSigner } from "wagmi"
import toast from "react-hot-toast"
import VestingPosition from "@/components/VestingPosition"

const VestingDashboard = ({ vestingData }) => {
  const { address: account } = useAccount()
  const myGrants = vestingData?.grants?.filter(grant => grant.beneficiary === account)

  if (!vestingData) return <>Loading</>

  return (
    <div className="flex flex-col gap-4 py-4">
      <div>
        <h2 className="text-lg py-2">Vesting overview</h2>
        {Object.keys(vestingData.tokens).map(tokenAddress => (
          <VestingInsights
            key={tokenAddress}
            totalAllocated={vestingData.totalAllocatedAmounts?.[tokenAddress] || BigNumber.from(0)}
            totalWithdrawn={vestingData.totalWithdrawnAmounts?.[tokenAddress] || BigNumber.from(0)}
            totalVested={vestingData.totalVestedAmounts?.[tokenAddress] || BigNumber.from(0)}
            tokenAddress={tokenAddress}
            tokens={vestingData.tokens}
          />
        ))}
      </div>
      {myGrants.length > 0 && (
        <div>
          <h2 className="text-lg py-2">Your position</h2>
          {myGrants.map(grant => (
            <VestingPosition
              key={grant.scheduleId}
              grant={grant}
              chainId={vestingData?.chainId}
              getReleasableAmount={vestingData?.getReleasableAmount}
              releaseAndWithdraw={vestingData?.releaseAndWithdraw}
            />
          ))}
        </div>
      )}
      <div>
        <h2 className="text-lg py-2">Stakeholders</h2>
        <VestingTable grants={vestingData.grants} tokens={vestingData.tokens} />
      </div>
    </div>
  )
}

const AddScheduleModal = ({ show, onClose, chainId, tokenAddresses, availableAmounts, addVestingSchedule }) => {
  const { handleSubmit, register, getValues, formState: { errors, isValid, isSubmitting } } = useForm()
  const tokenAddress = tokenAddresses?.[0]
  const availableAmount = availableAmounts?.[tokenAddress]
  const { symbol: tokenSymbol, decimals: tokenDecimals } = useTokenDetails(chainId, tokenAddress)
  const { data: signer } = useSigner()
  const formatToken = useTokenFormatter(chainId, tokenAddress)

  const withinAvailableTokens = (amount) => {
    if (!availableAmount) return true

    try {
      return availableAmount.gte(parseUnits(amount, tokenDecimals))
    } catch (e) {
      return true
    }
  }

  const endIsAfterStart = (end) => {
    const start = getValues("start")
    const startTime = Math.round(new Date(start).getTime() / 1000)
    const endTime = Math.round(new Date(end).getTime() / 1000)
    return endTime > startTime
  }

  const handleAddVestingSchedule = async ({ start, end, amount, beneficiary }) => {
    const schedule = {
      startTime: Math.round(new Date(start).getTime() / 1000),
      endTime: Math.round(new Date(end).getTime() / 1000),
      amount: parseUnits(amount, tokenDecimals),
      beneficiary,
      tokenAddress
    }
    const toastId = toast.loading("Sign transaction to add a schedule")
    try {
      const tx = await addVestingSchedule(signer, schedule)
      toast.loading(`Adding a schedule...`, { id: toastId })
      await tx.wait()
      toast.success("Successfully added a schedule to your vesting contract", { id: toastId })
      onClose()
    } catch (e) {
      console.error(e)

      // User didn't sign transaction
      if (e?.code === 4001 || e?.code === "ACTION_REJECTED") {
        toast.dismiss(toastId)
        return
      }

      // Display error message
      const message = e?.data?.message || e?.error?.message || e.message;
      toast.error("Something went wrong adding a schedule to your vesting contract", { id: toastId })
      toast.error(message)
    }
  }

  return (
    <Modal show={show} onClose={onClose}>
      <form onSubmit={handleSubmit(handleAddVestingSchedule)}>
        <ModalTitle>Add a vesting schedule</ModalTitle>
        <ModalBody>
          <div className="flex flex-col gap-2.5">
            <div>
              <Label>Stakeholder Address</Label>
              <Input
                placeholder="0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe"
                {...register("beneficiary", { required: true, validate: { isAddress } })}
              />
              <span className="text-xs text-red-400">
                {errors?.beneficiary?.type === "required" && "A valid address is required"}
                {errors?.beneficiary?.type === "isAddress" && "Invalid address"}
              </span>
            </div>
            <div>
              <Label>Start</Label>
              <Input
                type="datetime-local"
                {...register("start", { required: true })}
              />
              <span className="text-xs text-red-400">
                {errors?.start?.type === "required" && "A vesting start is required"}
              </span>
            </div>
            <div>
              <Label>End</Label>
              <Input
                type="datetime-local"
                {...register("end", { required: true, validation: { endIsAfterStart } })}
              />
              <span className="text-xs text-red-400">
                {errors?.end?.type === "endIsAfterStart" && "Vesting cannot end before it has started"}
                {errors?.end?.type === "required" && "A vesting end is required"}
              </span>
            </div>
            <div>
              <Label>Vesting Amount</Label>
              <CurrencyInput
                symbol={tokenSymbol}
                placeholder="0.00"
                {...register("amount", { required: true, min: 0, validate: { withinAvailableTokens } })}
              />
              <span className="text-xs text-red-400">
                {errors?.amount?.type === "withinAvailableTokens" && "Vesting contract does not have enough tokens available"}
                {errors?.amount?.type === "min" && "The vesting amount cannot be negative"}
                {errors?.amount?.type === "required" && "A vesting amount is required"}
              </span>
            </div>
          </div>
        </ModalBody>
        <ModalActionFooter>
          <div className="flex justify-between items-center w-full">
            <p className="text text-gray-800">
              {availableAmount && (
                <>Available tokens to allocate: {formatToken(availableAmount)}</>
              )}
            </p>
            <PrimaryButton type="submit" disabled={isSubmitting}>
              <span className="inline-flex items-center gap-1.5">
                {isSubmitting && <Spinner className="h-4 w-4" />}
                {isSubmitting && <span>Adding schedule</span>}
                {!isSubmitting && <span>Add schedule</span>}
              </span>
            </PrimaryButton>
          </div>
        </ModalActionFooter>
      </form>
    </Modal>
  )
}

const Vesting = () => {
  const [showAddScheduleModal, setShowAddScheduleModal] = useState(false)
  const [vestingData, setVestingData] = useState(null)
  const { query } = useRouter()
  const { contractType, contractAddress, chainId: chainIdString } = query
  const chainId = Number(chainIdString)

  const handleOpenAddScheduleModal = () => setShowAddScheduleModal(true)
  const handleCloseAddScheduleModal = () => setShowAddScheduleModal(false)

  const canAddSchedule = !!vestingData?.capabilities?.addVestingSchedule
  const tokenAddresses = vestingData?.tokenAddresses

  useEffect(() => {
    if (!contractType || !contractAddress || !chainId) return

    const retrieveVestingData = async () => {
      const vestingData = await getVestingData(contractType, chainId, contractAddress)
      setVestingData(vestingData)
    }

    retrieveVestingData()
  }, [contractType, contractAddress, chainId])

  return (
    <LayoutWrapper>
      <AddScheduleModal
        show={showAddScheduleModal}
        onClose={handleCloseAddScheduleModal}
        chainId={chainId}
        tokenAddresses={tokenAddresses}
        addVestingSchedule={vestingData?.addVestingSchedule}
        availableAmounts={vestingData?.availableAmounts}
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-gray-900">{contractType}</h1>
          {canAddSchedule && <PrimaryButton onClick={handleOpenAddScheduleModal}>Add Schedule</PrimaryButton>}
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
        <VestingDashboard vestingData={vestingData} />
      </div>
    </LayoutWrapper>
  )
}

export default Vesting